// 문법 포인트 성취도 판정 엔진 — 계획서 "단원 학습 흐름과 성취도 판정"
//
// 이벤트 하나를 받아 GrammarPointProgress의 다음 값을 계산한다 (DB 없음).
//  - 개념 완료·연습 → 학습 중 (연습 점수는 상태에 영향 없음, 활동량만)
//  - 확인 테스트 통과 기준 이상 → 통과, 3일 뒤 복습 예약 (취약에서도 통과로 돌아옴)
//  - 확인 테스트 60% 미만 누적 2회 → 취약 (이미 통과·숙달이면 확인 테스트로는 상태가 바뀌지 않음)
//  - 복습 통과 기준 이상 → 연속 횟수 +1, 다음 복습 7일 뒤, 학원 설정 횟수(기본 2회)면 숙달
//  - 복습 60% 미만 → 취약 + 연속 0 (다시 확인 테스트를 통과해야 함)
//  - 복습 60% 이상·통과 기준 미만 → 연속 0, 3일 뒤 다시 복습
//
// vitest로 테스트하므로 @/ 경로를 쓰지 않는다.

import { REVIEW_INTERVAL_DAYS, WEAK_FAIL_COUNT, WEAK_SCORE, type GrammarStep } from './constants'
import type { GrammarLearningSettings } from './settings'

export type GrammarMastery = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'MASTERED' | 'WEAK'

export interface MasteryProgress {
  state: GrammarMastery
  currentStep: GrammarStep
  conceptDoneAt: Date | null
  practiceCorrect: number
  practiceTotal: number
  bestCheckScore: number | null
  lastCheckScore: number | null
  checkAttempts: number
  lowScoreCount: number
  reviewStreak: number
  nextReviewAt: Date | null
  passedAt: Date | null
  masteredAt: Date | null
  lastActivityAt: Date
}

export type GrammarEvent =
  | { type: 'CONCEPT_DONE'; /** 강의가 있으면 다음 단계는 강의 */ hasLecture?: boolean }
  | { type: 'PRACTICE_DONE'; correct: number; total: number }
  | { type: 'CHECK_DONE'; score: number }
  | { type: 'REVIEW_DONE'; score: number }

export interface MasteryResult {
  progress: MasteryProgress
  /** 처음 통과 (보상 지급 기준 — 취약에서 다시 통과하면 false) */
  firstPass: boolean
  /** 처음 숙달 */
  firstMastery: boolean
  /** 이번 이벤트로 통과 판정(통과 기준 이상)이 났는지 — 결과 화면 표시용 */
  passedNow: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS)
}

/** 아직 기록이 없는 포인트의 초기 진도 */
export function initialProgress(now: Date): MasteryProgress {
  return {
    state: 'NOT_STARTED',
    currentStep: 'CONCEPT',
    conceptDoneAt: null,
    practiceCorrect: 0,
    practiceTotal: 0,
    bestCheckScore: null,
    lastCheckScore: null,
    checkAttempts: 0,
    lowScoreCount: 0,
    reviewStreak: 0,
    nextReviewAt: null,
    passedAt: null,
    masteredAt: null,
    lastActivityAt: now,
  }
}

export function isPassedMastery(state: GrammarMastery): boolean {
  return state === 'PASSED' || state === 'MASTERED'
}

/** 0~100 정수 점수 (문항 0개면 0) */
export function toScore(correct: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((Math.max(0, Math.min(correct, total)) / total) * 100)
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

/** 학습을 시작한 것으로 보는 상태 변경 (미학습 → 학습 중, 나머지는 유지) */
function started(state: GrammarMastery): GrammarMastery {
  return state === 'NOT_STARTED' ? 'IN_PROGRESS' : state
}

export function applyGrammarEvent(
  current: MasteryProgress | null,
  event: GrammarEvent,
  settings: GrammarLearningSettings,
  now: Date,
): MasteryResult {
  const prev = current ?? initialProgress(now)
  const next: MasteryProgress = { ...prev, lastActivityAt: now }
  let firstPass = false
  let firstMastery = false
  let passedNow = false

  switch (event.type) {
    case 'CONCEPT_DONE': {
      next.conceptDoneAt = prev.conceptDoneAt ?? now
      next.state = started(prev.state)
      next.currentStep = event.hasLecture ? 'LECTURE' : 'PRACTICE'
      break
    }

    case 'PRACTICE_DONE': {
      const total = Math.max(0, Math.floor(event.total))
      const correct = Math.max(0, Math.min(Math.floor(event.correct), total))
      next.practiceCorrect = prev.practiceCorrect + correct
      next.practiceTotal = prev.practiceTotal + total
      next.state = started(prev.state)
      next.currentStep = 'CHECK'
      break
    }

    case 'CHECK_DONE': {
      const score = clampScore(event.score)
      next.checkAttempts = prev.checkAttempts + 1
      next.lastCheckScore = score
      next.bestCheckScore = prev.bestCheckScore === null ? score : Math.max(prev.bestCheckScore, score)
      next.currentStep = 'RESULT'

      if (score >= settings.passScore) {
        passedNow = true
        next.lowScoreCount = 0
        // 이미 통과·숙달한 포인트를 다시 풀어 통과하면 상태·복습 일정은 그대로 둔다
        if (!isPassedMastery(prev.state)) {
          next.state = 'PASSED'
          next.reviewStreak = 0
          next.nextReviewAt = addDays(now, REVIEW_INTERVAL_DAYS[0])
          next.passedAt = prev.passedAt ?? now
          firstPass = prev.passedAt === null
        }
      } else {
        if (score < WEAK_SCORE) next.lowScoreCount = prev.lowScoreCount + 1
        if (!isPassedMastery(prev.state)) {
          next.state =
            prev.state === 'WEAK' || next.lowScoreCount >= WEAK_FAIL_COUNT ? 'WEAK' : 'IN_PROGRESS'
        }
      }
      break
    }

    case 'REVIEW_DONE': {
      const score = clampScore(event.score)
      // 복습은 통과·숙달한 포인트만 판정한다 (그 밖의 상태는 활동 시각만 갱신)
      if (!isPassedMastery(prev.state)) break

      if (score >= settings.passScore) {
        passedNow = true
        next.reviewStreak = prev.reviewStreak + 1
        if (next.reviewStreak >= settings.masteryReviewStreak) {
          next.state = 'MASTERED'
          next.nextReviewAt = null
          next.masteredAt = prev.masteredAt ?? now
          firstMastery = prev.masteredAt === null
        } else {
          const idx = Math.min(next.reviewStreak, REVIEW_INTERVAL_DAYS.length - 1)
          next.nextReviewAt = addDays(now, REVIEW_INTERVAL_DAYS[idx])
        }
      } else if (score < WEAK_SCORE) {
        next.state = 'WEAK'
        next.reviewStreak = 0
        next.nextReviewAt = null
      } else {
        next.reviewStreak = 0
        next.nextReviewAt = addDays(now, REVIEW_INTERVAL_DAYS[0])
      }
      break
    }
  }

  return { progress: next, firstPass, firstMastery, passedNow }
}
