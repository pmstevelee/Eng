// 재원생 상담 "학습 요약" 타입·라벨 (클라이언트/서버 공용 — 서버 전용 import 금지)
// Consultation.reportSnapshot 에 그대로 저장되므로 필드를 바꿀 때는 version 을 올리고
// 이전 버전 스냅샷도 읽을 수 있게 유지할 것.

export type SummaryDomain = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING' | 'WRITING'

export const SUMMARY_DOMAIN_LABEL: Record<SummaryDomain, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  LISTENING: '듣기',
  WRITING: '쓰기',
}

export const SUMMARY_DOMAIN_COLOR: Record<SummaryDomain, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  LISTENING: '#E91E8A',
  WRITING: '#E35C20',
}

export type WritingErrorTypeKey = 'grammar' | 'spelling' | 'vocabulary' | 'punctuation' | 'sentenceStructure'

export const WRITING_ERROR_TYPE_LABEL: Record<WritingErrorTypeKey, string> = {
  grammar: '문법',
  spelling: '철자',
  vocabulary: '어휘 선택',
  punctuation: '문장부호',
  sentenceStructure: '문장 구조',
}

/** 이번 기간 값과 직전 같은 길이 기간 값 (데이터가 없으면 null) */
export type SummaryMetric = { current: number | null; previous: number | null }

export type LearningSummary = {
  version: 1
  generatedAt: string
  /** KST 날짜 (YYYY-MM-DD, 양 끝 포함) */
  period: { from: string; to: string; days: number }
  previousPeriod: { from: string; to: string }
  /** 학습 활동(미션·연습·테스트·단어·쓰기)이 있었던 날 수 */
  studyDays: SummaryMetric
  /** 반 출석 (출석+지각 / 전체 기록, %) — 출석 기록이 없으면 null */
  attendance: { rate: SummaryMetric; present: number; late: number; absent: number; total: number }
  /** 연속 학습은 현재값만 저장되어 있어 기간 비교 없음 */
  streak: { current: number; longest: number }
  xp: SummaryMetric
  words: {
    /** 학습한 단어 수 (플래시카드·회상·스펠링 이벤트 기준, 중복 제외) */
    studied: SummaryMetric
    mastered: SummaryMetric
    /** 일일 복습을 완료한 날 수 */
    reviewDays: SummaryMetric
    /** 일일 복습 완료일 ÷ 기간 일수 (%) */
    reviewRate: SummaryMetric
    testAvg: SummaryMetric
    /** 생성 시점 기준 복습 기한이 지난 단어 수 (기간 비교 없음) */
    overdueNow: number
  }
  accuracy: {
    /** 전체 정답률 (%) */
    overall: SummaryMetric
    solved: SummaryMetric
    /** 이번 기간 주별 정답률 */
    weekly: { weekStart: string; rate: number; count: number }[]
    byDomain: { domain: SummaryDomain; rate: SummaryMetric; count: number }[]
  }
  /** 정답률이 낮은 영역 (문항 5개 이상 푼 영역 중, 최대 2개) */
  weakDomains: SummaryDomain[]
  level: {
    /** 기간 시작 시점 레벨 (이전 평가 기록 기준, 없으면 null) */
    start: number | null
    /** 기간 끝 시점 레벨 */
    end: number | null
    changes: { date: string; level: number; type: string }[]
  }
  writing: {
    graded: SummaryMetric
    errorTypes: { type: WritingErrorTypeKey; current: number; previous: number }[]
  }
}

export const LEVEL_ASSESSMENT_TYPE_LABEL: Record<string, string> = {
  PLACEMENT: '배치 테스트',
  PERIODIC: '정기 레벨 테스트',
  PROMOTION: '승급',
  TEACHER_OVERRIDE: '교사 조정',
}

/** 저장된 스냅샷(Json)이 현재 형식인지 확인 */
export function asLearningSummary(v: unknown): LearningSummary | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  return o.version === 1 && typeof o.period === 'object' ? (v as LearningSummary) : null
}

/** 증감 (둘 중 하나라도 없으면 null) */
export function metricDelta(m: SummaryMetric): number | null {
  return m.current === null || m.previous === null ? null : Math.round((m.current - m.previous) * 10) / 10
}
