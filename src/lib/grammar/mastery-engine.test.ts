import { describe, expect, it } from 'vitest'
import {
  applyGrammarEvent,
  initialProgress,
  toScore,
  type GrammarMastery,
  type MasteryProgress,
} from './mastery-engine'
import { parseGrammarLearningSettings, DEFAULT_GRAMMAR_LEARNING_SETTINGS } from './settings'

const now = new Date('2026-10-26T03:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const settings = DEFAULT_GRAMMAR_LEARNING_SETTINGS

function progress(partial: Partial<MasteryProgress>): MasteryProgress {
  return { ...initialProgress(new Date('2026-10-01T00:00:00Z')), ...partial }
}

function check(state: GrammarMastery, score: number, extra: Partial<MasteryProgress> = {}) {
  return applyGrammarEvent(progress({ state, ...extra }), { type: 'CHECK_DONE', score }, settings, now)
}

function review(state: GrammarMastery, score: number, extra: Partial<MasteryProgress> = {}) {
  return applyGrammarEvent(progress({ state, ...extra }), { type: 'REVIEW_DONE', score }, settings, now)
}

describe('parseGrammarLearningSettings', () => {
  it('설정이 없으면 기본값 80% / 2회', () => {
    expect(parseGrammarLearningSettings(null)).toEqual({ passScore: 80, masteryReviewStreak: 2 })
    expect(parseGrammarLearningSettings({ wordLearning: {} })).toEqual({ passScore: 80, masteryReviewStreak: 2 })
  })

  it('범위 안의 값은 그대로', () => {
    expect(parseGrammarLearningSettings({ grammarLearning: { passScore: 60, masteryReviewStreak: 1 } })).toEqual({
      passScore: 60,
      masteryReviewStreak: 1,
    })
    expect(parseGrammarLearningSettings({ grammarLearning: { passScore: 100, masteryReviewStreak: 3 } })).toEqual({
      passScore: 100,
      masteryReviewStreak: 3,
    })
  })

  it('범위 밖·형식 오류는 기본값', () => {
    expect(parseGrammarLearningSettings({ grammarLearning: { passScore: 59, masteryReviewStreak: 0 } })).toEqual({
      passScore: 80,
      masteryReviewStreak: 2,
    })
    expect(parseGrammarLearningSettings({ grammarLearning: { passScore: 101, masteryReviewStreak: 4 } })).toEqual({
      passScore: 80,
      masteryReviewStreak: 2,
    })
    expect(parseGrammarLearningSettings({ grammarLearning: { passScore: '70', masteryReviewStreak: 1.5 } })).toEqual({
      passScore: 80,
      masteryReviewStreak: 2,
    })
  })
})

describe('toScore', () => {
  it('반올림한 정수 퍼센트', () => {
    expect(toScore(8, 10)).toBe(80)
    expect(toScore(2, 3)).toBe(67)
    expect(toScore(0, 0)).toBe(0)
    expect(toScore(12, 10)).toBe(100)
  })
})

describe('CONCEPT_DONE / PRACTICE_DONE', () => {
  it('기록이 없으면 개념 완료로 학습 중이 되고 연습 단계로 간다', () => {
    const r = applyGrammarEvent(null, { type: 'CONCEPT_DONE' }, settings, now)
    expect(r.progress.state).toBe('IN_PROGRESS')
    expect(r.progress.currentStep).toBe('PRACTICE')
    expect(r.progress.conceptDoneAt).toEqual(now)
  })

  it('강의가 있으면 강의 단계로 간다', () => {
    const r = applyGrammarEvent(null, { type: 'CONCEPT_DONE', hasLecture: true }, settings, now)
    expect(r.progress.currentStep).toBe('LECTURE')
  })

  it('개념 완료 시각은 처음 값을 유지하고 통과 상태는 바꾸지 않는다', () => {
    const first = new Date('2026-10-02T00:00:00Z')
    const r = applyGrammarEvent(progress({ state: 'PASSED', conceptDoneAt: first }), { type: 'CONCEPT_DONE' }, settings, now)
    expect(r.progress.conceptDoneAt).toEqual(first)
    expect(r.progress.state).toBe('PASSED')
  })

  it('연습은 점수와 무관하게 활동량만 누적하고 확인 테스트 단계로 간다', () => {
    const r = applyGrammarEvent(
      progress({ state: 'NOT_STARTED', practiceCorrect: 3, practiceTotal: 12 }),
      { type: 'PRACTICE_DONE', correct: 0, total: 12 },
      settings,
      now,
    )
    expect(r.progress.state).toBe('IN_PROGRESS')
    expect(r.progress.practiceCorrect).toBe(3)
    expect(r.progress.practiceTotal).toBe(24)
    expect(r.progress.currentStep).toBe('CHECK')
    expect(r.passedNow).toBe(false)
  })

  it('연습은 취약 상태를 바꾸지 않는다', () => {
    const r = applyGrammarEvent(progress({ state: 'WEAK' }), { type: 'PRACTICE_DONE', correct: 12, total: 12 }, settings, now)
    expect(r.progress.state).toBe('WEAK')
  })
})

describe('CHECK_DONE', () => {
  it('80%면 통과, 3일 뒤 복습, 첫 통과', () => {
    const r = check('IN_PROGRESS', 80)
    expect(r.progress.state).toBe('PASSED')
    expect(r.progress.nextReviewAt).toEqual(new Date(now.getTime() + 3 * DAY))
    expect(r.progress.passedAt).toEqual(now)
    expect(r.progress.currentStep).toBe('RESULT')
    expect(r.firstPass).toBe(true)
    expect(r.passedNow).toBe(true)
  })

  it('79%는 미달 (학습 중 유지, 저득점 아님)', () => {
    const r = check('IN_PROGRESS', 79)
    expect(r.progress.state).toBe('IN_PROGRESS')
    expect(r.progress.lowScoreCount).toBe(0)
    expect(r.passedNow).toBe(false)
  })

  it('60%는 저득점이 아니다', () => {
    const r = check('IN_PROGRESS', 60, { lowScoreCount: 1 })
    expect(r.progress.lowScoreCount).toBe(1)
    expect(r.progress.state).toBe('IN_PROGRESS')
  })

  it('60% 미만 1회는 학습 중, 누적 2회면 취약', () => {
    const once = check('IN_PROGRESS', 59)
    expect(once.progress.lowScoreCount).toBe(1)
    expect(once.progress.state).toBe('IN_PROGRESS')

    const twice = applyGrammarEvent(once.progress, { type: 'CHECK_DONE', score: 30 }, settings, now)
    expect(twice.progress.lowScoreCount).toBe(2)
    expect(twice.progress.state).toBe('WEAK')
  })

  it('누적이므로 사이에 60~79점이 있어도 2회째 저득점이면 취약', () => {
    const r = check('IN_PROGRESS', 50, { lowScoreCount: 1, checkAttempts: 2 })
    expect(r.progress.state).toBe('WEAK')
  })

  it('취약에서 미달이면 취약 유지, 통과하면 통과로 돌아오지만 첫 통과 보상은 없다', () => {
    expect(check('WEAK', 70, { lowScoreCount: 2 }).progress.state).toBe('WEAK')

    const passed = check('WEAK', 90, { lowScoreCount: 2, passedAt: new Date('2026-10-05T00:00:00Z') })
    expect(passed.progress.state).toBe('PASSED')
    expect(passed.progress.lowScoreCount).toBe(0)
    expect(passed.progress.reviewStreak).toBe(0)
    expect(passed.firstPass).toBe(false)
    expect(passed.progress.passedAt).toEqual(new Date('2026-10-05T00:00:00Z'))
  })

  it('처음부터 취약인 적 없이 통과 기록 없는 취약 → 통과는 첫 통과', () => {
    expect(check('WEAK', 100).firstPass).toBe(true)
  })

  it('이미 통과·숙달한 포인트는 확인 테스트로 상태·복습 일정이 바뀌지 않는다', () => {
    const review = new Date('2026-10-28T00:00:00Z')
    const low = check('PASSED', 10, { nextReviewAt: review, reviewStreak: 1, lowScoreCount: 1 })
    expect(low.progress.state).toBe('PASSED')
    expect(low.progress.nextReviewAt).toEqual(review)
    expect(low.progress.reviewStreak).toBe(1)

    const high = check('MASTERED', 100, { nextReviewAt: null })
    expect(high.progress.state).toBe('MASTERED')
    expect(high.progress.nextReviewAt).toBeNull()
    expect(high.firstPass).toBe(false)
    expect(high.passedNow).toBe(true)
  })

  it('최고·최근 점수와 시도 횟수를 기록한다', () => {
    const r = check('IN_PROGRESS', 70, { bestCheckScore: 90, lastCheckScore: 90, checkAttempts: 1 })
    expect(r.progress.bestCheckScore).toBe(90)
    expect(r.progress.lastCheckScore).toBe(70)
    expect(r.progress.checkAttempts).toBe(2)
    expect(check('NOT_STARTED', 40).progress.bestCheckScore).toBe(40)
  })

  it('점수는 0~100으로 자른다', () => {
    expect(check('IN_PROGRESS', 130).progress.lastCheckScore).toBe(100)
    expect(check('IN_PROGRESS', -5).progress.lastCheckScore).toBe(0)
  })

  it('학원 통과 기준 70%면 70점 통과, 69점 미달', () => {
    const s70 = { passScore: 70, masteryReviewStreak: 2 }
    expect(applyGrammarEvent(progress({ state: 'IN_PROGRESS' }), { type: 'CHECK_DONE', score: 70 }, s70, now).progress.state).toBe('PASSED')
    expect(applyGrammarEvent(progress({ state: 'IN_PROGRESS' }), { type: 'CHECK_DONE', score: 69 }, s70, now).progress.state).toBe('IN_PROGRESS')
  })

  it('통과 기준 60%면 59점은 저득점 미달, 60점은 통과', () => {
    const s60 = { passScore: 60, masteryReviewStreak: 2 }
    const fail = applyGrammarEvent(progress({ state: 'IN_PROGRESS' }), { type: 'CHECK_DONE', score: 59 }, s60, now)
    expect(fail.progress.state).toBe('IN_PROGRESS')
    expect(fail.progress.lowScoreCount).toBe(1)
    expect(applyGrammarEvent(progress({ state: 'IN_PROGRESS' }), { type: 'CHECK_DONE', score: 60 }, s60, now).progress.state).toBe('PASSED')
  })
})

describe('REVIEW_DONE', () => {
  it('1회차 복습 80% → 연속 1, 다음 복습 7일 뒤', () => {
    const r = review('PASSED', 80)
    expect(r.progress.state).toBe('PASSED')
    expect(r.progress.reviewStreak).toBe(1)
    expect(r.progress.nextReviewAt).toEqual(new Date(now.getTime() + 7 * DAY))
    expect(r.firstMastery).toBe(false)
  })

  it('2회 연속 80% 이상이면 숙달, 복습 일정 종료', () => {
    const r = review('PASSED', 100, { reviewStreak: 1 })
    expect(r.progress.state).toBe('MASTERED')
    expect(r.progress.masteredAt).toEqual(now)
    expect(r.progress.nextReviewAt).toBeNull()
    expect(r.firstMastery).toBe(true)
  })

  it('숙달 기준 1회면 첫 복습 통과로 숙달, 3회면 2회째는 아직 통과', () => {
    const s1 = { passScore: 80, masteryReviewStreak: 1 }
    expect(applyGrammarEvent(progress({ state: 'PASSED' }), { type: 'REVIEW_DONE', score: 80 }, s1, now).progress.state).toBe('MASTERED')
    const s3 = { passScore: 80, masteryReviewStreak: 3 }
    const second = applyGrammarEvent(progress({ state: 'PASSED', reviewStreak: 1 }), { type: 'REVIEW_DONE', score: 80 }, s3, now)
    expect(second.progress.state).toBe('PASSED')
    expect(second.progress.nextReviewAt).toEqual(new Date(now.getTime() + 7 * DAY))
  })

  it('60~79점은 연속 초기화, 3일 뒤 다시 복습, 상태 유지', () => {
    const r = review('PASSED', 60, { reviewStreak: 1 })
    expect(r.progress.state).toBe('PASSED')
    expect(r.progress.reviewStreak).toBe(0)
    expect(r.progress.nextReviewAt).toEqual(new Date(now.getTime() + 3 * DAY))
    expect(review('PASSED', 79).passedNow).toBe(false)
  })

  it('60% 미만이면 취약 + 연속 0 + 복습 일정 없음 (통과·숙달 모두)', () => {
    const fromPassed = review('PASSED', 59, { reviewStreak: 1 })
    expect(fromPassed.progress.state).toBe('WEAK')
    expect(fromPassed.progress.reviewStreak).toBe(0)
    expect(fromPassed.progress.nextReviewAt).toBeNull()
    expect(review('MASTERED', 0).progress.state).toBe('WEAK')
  })

  it('다시 숙달해도 첫 숙달 보상은 없다', () => {
    const r = review('PASSED', 100, { reviewStreak: 1, masteredAt: new Date('2026-10-10T00:00:00Z') })
    expect(r.progress.state).toBe('MASTERED')
    expect(r.firstMastery).toBe(false)
  })

  it('통과 전(학습 중·취약)에는 복습이 상태를 바꾸지 않는다', () => {
    const r = review('WEAK', 100, { reviewStreak: 0 })
    expect(r.progress.state).toBe('WEAK')
    expect(r.progress.reviewStreak).toBe(0)
    expect(r.progress.lastActivityAt).toEqual(now)
    expect(review('IN_PROGRESS', 100).progress.state).toBe('IN_PROGRESS')
  })

  it('복습은 현재 단계를 바꾸지 않는다', () => {
    expect(review('PASSED', 100, { currentStep: 'RESULT' }).progress.currentStep).toBe('RESULT')
  })
})

describe('전체 흐름', () => {
  it('개념 → 연습 → 확인 미달 → 확인 통과 → 복습 2회 → 숙달', () => {
    let p = applyGrammarEvent(null, { type: 'CONCEPT_DONE' }, settings, now).progress
    p = applyGrammarEvent(p, { type: 'PRACTICE_DONE', correct: 9, total: 12 }, settings, now).progress
    p = applyGrammarEvent(p, { type: 'CHECK_DONE', score: 70 }, settings, now).progress
    expect(p.state).toBe('IN_PROGRESS')
    const pass = applyGrammarEvent(p, { type: 'CHECK_DONE', score: 90 }, settings, now)
    expect(pass.firstPass).toBe(true)
    const r1 = applyGrammarEvent(pass.progress, { type: 'REVIEW_DONE', score: 80 }, settings, now)
    const r2 = applyGrammarEvent(r1.progress, { type: 'REVIEW_DONE', score: 100 }, settings, now)
    expect(r2.progress.state).toBe('MASTERED')
    expect(r2.firstMastery).toBe(true)
  })
})
