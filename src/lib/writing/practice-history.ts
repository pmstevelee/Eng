import type { Prisma } from '@/generated/prisma'
import type { WritingEvaluationResult } from '@/app/api/ai/evaluate-writing/route'
import type { DomainLevels } from '@/lib/ai/domain-level-calculator'

/**
 * 쓰기 연습 이력(reports.type = WRITING_PRACTICE) 화면 표시용 정규화 모델.
 *
 * dataJson은 저장 시점에 따라 형식이 다르다.
 * - 구형: scores / totalScore / totalMaxScore / overallComment / modelEssay.keyFeatures
 * - 신형: detailedScores / overallEvaluation / modelEssay.levelFeatures (evaluate-writing route)
 * 화면은 항상 이 모델만 사용하고, 원본 JSON은 normalizeWritingPracticeData()로 변환한다.
 */
export type WritingPracticeScoreView = {
  key: string
  label: string
  score: number
  max: number
  details: string
}

export type WritingPracticeCorrectionView = {
  original: string
  corrected: string
  explanation: string
  category: string | null
}

export type WritingPracticeView = {
  topicTitle: string
  essay: string
  wordCount: number
  /** 작성 당시 학생 레벨 */
  level: number | null
  /** 이번 글의 AI 쓰기 레벨 판정 (결과 화면의 Lv. 값) */
  assessedLevel: number | null
  cefrLevel: string | null
  /** 0~100 백분율 점수 */
  percentage: number
  totalScore: number
  totalMaxScore: number
  overallComment: string
  scores: WritingPracticeScoreView[]
  corrections: WritingPracticeCorrectionView[]
  modelEssay: { text: string; wordCount: number; keyFeatures: string[] } | null
  /**
   * 신형(현재) 저장 데이터면 AI 피드백 직후 화면과 동일하게 보여주기 위한 원본 평가 결과.
   * 필수 필드가 빠진 이전 형식이면 null (위 요약 필드로 표시).
   */
  feedback: WritingEvaluationResult | null
  /** 평가 당시 학생의 영역별 레벨 (피드백 화면의 5영역 비교용) */
  domainLevels: DomainLevels | null
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

// 구형 scores 키 → 라벨
const LEGACY_SCORE_KEYS: { key: string; label: string }[] = [
  { key: 'grammar', label: '문법' },
  { key: 'organization', label: '구성' },
  { key: 'vocabulary', label: '어휘' },
  { key: 'expression', label: '표현' },
]

// 신형 detailedScores 키 → 라벨 (각 항목 0~100점)
const DETAILED_SCORE_KEYS: { key: string; label: string }[] = [
  { key: 'grammarInWriting', label: '문법' },
  { key: 'organization', label: '구성' },
  { key: 'vocabularyInWriting', label: '어휘' },
  { key: 'expression', label: '표현' },
]

function buildScores(data: JsonRecord): WritingPracticeScoreView[] {
  const legacy = asRecord(data.scores)
  if (legacy) {
    return LEGACY_SCORE_KEYS.flatMap(({ key, label }) => {
      const s = asRecord(legacy[key])
      const score = asNumber(s?.score)
      if (!s || score === null) return []
      return [
        { key, label, score, max: asNumber(s.maxForLevel) ?? 100, details: asString(s.details) },
      ]
    })
  }

  const detailed = asRecord(data.detailedScores)
  if (detailed) {
    return DETAILED_SCORE_KEYS.flatMap(({ key, label }) => {
      const s = asRecord(detailed[key])
      const score = asNumber(s?.score)
      if (!s || score === null) return []
      return [{ key, label, score, max: 100, details: asString(s.detail) }]
    })
  }

  return []
}

function buildCorrections(data: JsonRecord): WritingPracticeCorrectionView[] {
  if (!Array.isArray(data.corrections)) return []
  return data.corrections.flatMap((item) => {
    const c = asRecord(item)
    if (!c) return []
    const original = asString(c.original)
    const corrected = asString(c.corrected)
    if (!original && !corrected) return []
    return [
      {
        original,
        corrected,
        explanation: asString(c.explanation),
        category: typeof c.category === 'string' ? c.category : null,
      },
    ]
  })
}

function buildModelEssay(data: JsonRecord): WritingPracticeView['modelEssay'] {
  const m = asRecord(data.modelEssay)
  const text = asString(m?.text)
  if (!m || !text) return null
  const keyFeatures = asStringArray(m.keyFeatures)
  return {
    text,
    wordCount: asNumber(m.wordCount) ?? text.trim().split(/\s+/).filter(Boolean).length,
    keyFeatures: keyFeatures.length > 0 ? keyFeatures : asStringArray(m.levelFeatures),
  }
}

// evaluate-writing route가 저장하는 전체 평가 결과 필드 중 피드백 화면이 반드시 필요로 하는 객체들
const FEEDBACK_REQUIRED_RECORDS = [
  'writingLevelAssessment',
  'detailedScores',
  'crossDomainAnalysis',
  'levelUpStrategy',
  'modelEssay',
  'categoryScores',
] as const

/** 저장된 dataJson을 AI 피드백 직후 화면에서 쓰던 결과 객체 그대로 복원한다. */
function buildFeedback(data: JsonRecord): WritingEvaluationResult | null {
  if (FEEDBACK_REQUIRED_RECORDS.some((key) => !asRecord(data[key]))) return null
  const list = (value: unknown) => (Array.isArray(value) ? value : [])
  return {
    ...(data as unknown as WritingEvaluationResult),
    corrections: list(data.corrections),
    rubricItems: list(data.rubricItems),
    strengths: list(data.strengths),
    errors: list(data.errors),
    spellingErrorSummary: list(data.spellingErrorSummary),
    grammarErrorSummary: list(data.grammarErrorSummary),
    essayAnalysis: (asRecord(data.essayAnalysis) ??
      null) as WritingEvaluationResult['essayAnalysis'],
    improvedVersion: asString(data.improvedVersion),
    nextStepRecommendation: asString(data.nextStepRecommendation),
  }
}

export function normalizeWritingPracticeData(raw: Prisma.JsonValue): WritingPracticeView {
  const data = asRecord(raw) ?? {}
  const detailed = asRecord(data.detailedScores)
  const overall = asRecord(data.overallEvaluation)
  const assessment = asRecord(data.writingLevelAssessment)

  const legacyTotal = asNumber(data.totalScore)
  const legacyMax = asNumber(data.totalMaxScore)
  // 결과 화면의 총점은 평가항목(루브릭) 합계(overallEvaluation.totalPoints)이므로 이를 우선한다.
  // (이전에는 percentage에 detailedScores.totalScore가 저장되어 결과 화면 점수와 달랐음)
  const percentage =
    asNumber(overall?.totalPoints) ??
    asNumber(data.percentage) ??
    asNumber(detailed?.totalScore) ??
    (legacyTotal !== null && legacyMax ? (legacyTotal / legacyMax) * 100 : 0)

  const hasLegacyTotal = legacyTotal !== null && legacyMax !== null && legacyMax > 0
  const essay = asString(data.essay)

  return {
    topicTitle: asString(data.topicTitle) || '쓰기 연습',
    essay,
    wordCount: asNumber(data.wordCount) ?? essay.trim().split(/\s+/).filter(Boolean).length,
    level: asNumber(data.level),
    assessedLevel: asNumber(data.assessedLevel),
    cefrLevel:
      asString(data.cefrLevel) ||
      asString(detailed?.totalCefr) ||
      asString(assessment?.assessedCefr) ||
      null,
    percentage,
    totalScore: hasLegacyTotal ? legacyTotal : Math.round(percentage),
    totalMaxScore: hasLegacyTotal ? legacyMax : 100,
    overallComment:
      asString(data.overallComment) ||
      asString(overall?.summaryKo) ||
      asString(assessment?.summary),
    scores: buildScores(data),
    corrections: buildCorrections(data),
    modelEssay: buildModelEssay(data),
    feedback: buildFeedback(data),
    domainLevels: (asRecord(data.domainLevels) ?? null) as DomainLevels | null,
  }
}
