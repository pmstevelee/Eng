import type { LearnStage } from '@/generated/prisma'

// 단어 학습 단계 전이 규칙 (순수 함수 — 서버 액션과 단위 테스트가 공유)
//
// - 학습 단계: FLASHCARD → RECALL → SPELL. 스펠을 처음 맞히면 "학습 완료"(learnedAt).
// - 마스터: 학습 완료 후 서로 다른 날의 연속 정답으로 SRS repetitions가 MASTERY_REPETITIONS 이상이 되면 MASTERED.
//   (같은 날의 다단계 학습은 SRS를 1회만 진행시키므로 하루 만에 마스터될 수 없다)
// - 정답이면 단계는 절대 내려가지 않는다.
// - 학습 완료(전날 이전) 또는 마스터 단어를 틀리면 망각(lapse): RECALL로 강등, 마스터 해제, SRS 초기화.

export type StudyContext = 'LEARN' | 'REVIEW' | 'TEST'
export type StudyActivity = 'FLASHCARD' | 'RECALL' | 'SPELL'

/** 마스터에 필요한 서로 다른 날 연속 정답 수 (SRS 간격 1일 → 6일 → 15일) */
export const MASTERY_REPETITIONS = 3

/** 어려운 단어 판정 기준 */
export const DIFFICULT_MIN_LAPSES = 2
export const DIFFICULT_MIN_WRONG = 2

const STAGE_ORDER: Record<LearnStage, number> = {
  FLASHCARD: 0,
  RECALL: 1,
  SPELL: 2,
  MASTERED: 3,
}

/** 정답 시 해당 활동이 도달시키는 단계 */
const STAGE_AFTER_CORRECT: Record<StudyActivity, LearnStage> = {
  FLASHCARD: 'RECALL',
  RECALL: 'SPELL',
  SPELL: 'SPELL',
}

function maxStage(a: LearnStage, b: LearnStage): LearnStage {
  return STAGE_ORDER[a] >= STAGE_ORDER[b] ? a : b
}

export interface MasteryInput {
  current: LearnStage
  activity: StudyActivity
  isCorrect: boolean
  /** 이번 응답을 반영한 뒤의 SRS repetitions */
  repetitionsAfter: number
  /** 오늘 이전에 이미 학습 완료된 단어인지 (learnedAt이 어제 이전이거나 MASTERED) */
  learnedBeforeToday: boolean
  /** 학습 완료 기록(learnedAt) 존재 여부 */
  hasLearnedAt: boolean
}

export interface MasteryOutcome {
  stage: LearnStage
  isLapse: boolean
  becameLearned: boolean
  becameMastered: boolean
  lostMastery: boolean
}

export function resolveMastery(input: MasteryInput): MasteryOutcome {
  const { current, activity, isCorrect, repetitionsAfter, learnedBeforeToday, hasLearnedAt } = input

  if (!isCorrect) {
    const isLapse = learnedBeforeToday || current === 'MASTERED'
    if (!isLapse) {
      return { stage: current, isLapse: false, becameLearned: false, becameMastered: false, lostMastery: false }
    }
    return {
      stage: 'RECALL',
      isLapse: true,
      becameLearned: false,
      becameMastered: false,
      lostMastery: current === 'MASTERED',
    }
  }

  let stage = maxStage(current, STAGE_AFTER_CORRECT[activity])
  const becameLearned = activity === 'SPELL' && !hasLearnedAt
  const isLearned = hasLearnedAt || becameLearned || current === 'MASTERED'

  let becameMastered = false
  if (
    current !== 'MASTERED' &&
    isLearned &&
    activity !== 'FLASHCARD' &&
    repetitionsAfter >= MASTERY_REPETITIONS
  ) {
    stage = 'MASTERED'
    becameMastered = true
  }

  return { stage, isLapse: false, becameLearned, becameMastered, lostMastery: false }
}

/** 어려운 단어 여부 — 복습 우선순위·리포트에서 사용 */
export function isDifficultWord(p: { lapses: number; wrongCount: number; correctCount: number }): boolean {
  if (p.lapses >= DIFFICULT_MIN_LAPSES) return true
  return p.wrongCount >= DIFFICULT_MIN_WRONG && p.wrongCount >= p.correctCount
}
