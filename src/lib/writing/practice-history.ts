import type { Prisma } from '@/generated/prisma'

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
  level: number | null
  cefrLevel: string | null
  /** 0~100 백분율 점수 */
  percentage: number
  totalScore: number
  totalMaxScore: number
  overallComment: string
  scores: WritingPracticeScoreView[]
  corrections: WritingPracticeCorrectionView[]
  modelEssay: { text: string; wordCount: number; keyFeatures: string[] } | null
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

export function normalizeWritingPracticeData(raw: Prisma.JsonValue): WritingPracticeView {
  const data = asRecord(raw) ?? {}
  const detailed = asRecord(data.detailedScores)
  const overall = asRecord(data.overallEvaluation)
  const assessment = asRecord(data.writingLevelAssessment)

  const legacyTotal = asNumber(data.totalScore)
  const legacyMax = asNumber(data.totalMaxScore)
  const percentage =
    asNumber(data.percentage) ??
    asNumber(overall?.totalPoints) ??
    asNumber(detailed?.totalScore) ??
    (legacyTotal !== null && legacyMax ? (legacyTotal / legacyMax) * 100 : 0)

  const hasLegacyTotal = legacyTotal !== null && legacyMax !== null && legacyMax > 0
  const essay = asString(data.essay)

  return {
    topicTitle: asString(data.topicTitle) || '쓰기 연습',
    essay,
    wordCount: asNumber(data.wordCount) ?? essay.trim().split(/\s+/).filter(Boolean).length,
    level: asNumber(data.level),
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
  }
}
