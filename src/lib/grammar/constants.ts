// 문법학습관리 판정 기준·화면 상수 — 서버·클라이언트 공용
//
// 통과 기준(PASS_SCORE)과 숙달 복습 횟수(MASTERY_REVIEW_STREAK)는 기본값이다.
// 학원장이 설정(Academy.settingsJson.grammarLearning)에서 바꾸면 그 값이 우선한다.

import type { GrammarAttemptKind, GrammarMasteryState, GrammarPointStatus } from '@/generated/prisma'

// ─── 판정 기준 (기본값) ──────────────────────────────────────────────────────

/** 확인 테스트 통과 점수(%) — 학원 설정 범위 60~100 */
export const PASS_SCORE = 80
export const PASS_SCORE_RANGE = { min: 60, max: 100 } as const

/** 이 점수(%) 미만이면 저득점 — 확인 테스트 누적 WEAK_FAIL_COUNT회 또는 복습 1회면 취약 */
export const WEAK_SCORE = 60
export const WEAK_FAIL_COUNT = 2

/** 통과 후 포인트 복습 간격(일) — 1회차 3일 뒤, 이후 7일 뒤 */
export const REVIEW_INTERVAL_DAYS = [3, 7] as const

/** 숙달에 필요한 포인트 복습 연속 통과 횟수 — 학원 설정 범위 1~3 */
export const MASTERY_REVIEW_STREAK = 2
export const MASTERY_REVIEW_STREAK_RANGE = { min: 1, max: 3 } as const

/** 강의 완료로 인정하는 시청률(%) */
export const LECTURE_COMPLETE_PERCENT = 80

// ─── 문항 수 ─────────────────────────────────────────────────────────────────

export const PRACTICE_SIZE = 12
export const CHECK_SIZE = 10
export const REVIEW_SIZE = 5
export const CHAPTER_SIZE = 20

/** 공개 가능한 포인트의 최소 검수 완료 문항 수 (연습 12 + 확인 10) */
export const MIN_PUBLISH_QUESTIONS = PRACTICE_SIZE + CHECK_SIZE

// ─── 보상 ────────────────────────────────────────────────────────────────────

export const XP_PASS = 30
export const XP_MASTER = 20

// ─── 단원 진행 단계 (GrammarPointProgress.currentStep) ─────────────────────────

export const GRAMMAR_STEPS = ['CONCEPT', 'LECTURE', 'PRACTICE', 'CHECK', 'RESULT'] as const
export type GrammarStep = (typeof GRAMMAR_STEPS)[number]

export const GRAMMAR_STEP_LABEL: Record<GrammarStep, string> = {
  CONCEPT: '개념',
  LECTURE: '강의',
  PRACTICE: '연습',
  CHECK: '확인 테스트',
  RESULT: '결과',
}

export function isGrammarStep(value: string): value is GrammarStep {
  return (GRAMMAR_STEPS as readonly string[]).includes(value)
}

// ─── 라벨·색 ────────────────────────────────────────────────────────────────

type StateStyle = {
  label: string
  /** 칸·막대 색 */
  color: string
  /** 배지 배경 / 글자 색 */
  bg: string
  text: string
  /** 색만으로 구분하지 않도록 히트맵 칸에 쓰는 약어 */
  short: string
}

export const GRAMMAR_STATE_STYLE: Record<GrammarMasteryState, StateStyle> = {
  NOT_STARTED: { label: '미학습', color: '#D1D5DB', bg: '#F3F4F6', text: '#4B5563', short: '' },
  IN_PROGRESS: { label: '학습 중', color: '#1865F2', bg: '#EEF4FF', text: '#1865F2', short: '중' },
  PASSED: { label: '통과', color: '#86D9A5', bg: '#E8F7EE', text: '#15803D', short: '통' },
  MASTERED: { label: '숙달', color: '#1FAF54', bg: '#DCF5E5', text: '#166534', short: '숙' },
  WEAK: { label: '취약', color: '#D92916', bg: '#FDECEA', text: '#B42318', short: '취' },
}

export const GRAMMAR_POINT_STATUS_LABEL: Record<GrammarPointStatus, string> = {
  DRAFT: '초안',
  REVIEW: '검수 요청',
  PUBLISHED: '공개',
}

export const GRAMMAR_ATTEMPT_KIND_LABEL: Record<GrammarAttemptKind, string> = {
  PRACTICE: '연습',
  CHECK: '확인 테스트',
  REVIEW: '복습',
  CHAPTER: '대분류 평가',
}

/** 태깅 제안 상태 (GrammarTagSuggestion.status) */
export const GRAMMAR_TAG_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED'] as const
export type GrammarTagStatus = (typeof GRAMMAR_TAG_STATUSES)[number]

/** 커리큘럼 캐시 태그 — 트리·포인트 편집 시 revalidateTag */
export const GRAMMAR_CURRICULUM_TAG = 'grammar-curriculum'

/** "다음 단원" 카드 제목 — 문법 홈·오늘의 학습 공용 (next-unit.ts NextUnitReason) */
export const NEXT_UNIT_REASON_LABEL: Record<'IN_PROGRESS' | 'WEAK_STALE' | 'ASSIGNED' | 'COURSE', string> = {
  IN_PROGRESS: '이어서 학습',
  WEAK_STALE: '다시 볼 취약 단원',
  ASSIGNED: '선생님이 배정한 단원',
  COURSE: '추천 단원',
}
