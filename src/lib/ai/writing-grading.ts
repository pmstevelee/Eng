// 쓰기 채점 AI 공용 스키마/프롬프트 (테스트관리 쓰기항목, 학습공간 글쓰기연습 공통 사용)

export type WritingTaskFormat = 'sentence_practice' | 'academic_essay'

export type WritingErrorType =
  | 'grammar'
  | 'spelling'
  | 'vocabulary'
  | 'punctuation'
  | 'sentenceStructure'

export type WritingErrorSeverity = 'minor' | 'moderate' | 'major'

export type WritingError = {
  type: WritingErrorType
  subType: string
  /** 틀린 표현 (wrongExpression) */
  original: string
  /** 맞는 표현 (correctExpression) */
  corrected: string
  explanationKo: string
  severity: WritingErrorSeverity
  occurrenceCount: number
  /** 왜 틀렸는지 */
  whyItsWrong?: string
  /** 암기 팁 */
  howToRemember?: string
  /** 문단형 상세 설명 */
  detailedExplanationKo?: string
  similarCorrectExamples?: string[]
  /** 같은 유형이 반복된 다른 위치 인용 */
  otherOccurrences?: string[]
}

export type SpellingErrorSummaryItem = {
  misspelled: string
  correct: string
  occurrenceCount: number
}

export type GrammarErrorSummaryItem = {
  category: string
  count: number
  examples: string[]
}

export type WritingCategoryScores = {
  grammar: number
  spelling: number
  vocabulary: number
  sentenceStructure: number
  coherence: number
  taskAchievement: number
}

// ── 평가항목/가중치 (항목별 100점 만점 채점 → 가중평균으로 전체 100점 산출) ──────
// 각 항목은 그 자체로 0~100점 만점 채점한다. weight(%)는 전체 총점에서 그 항목이
// 차지하는 비중이며, 모든 항목의 weight 합은 항상 100이다.
// 총점 = Σ(항목 score × 항목 weight ÷ 100)

export type WritingRubricDefinition = {
  key: string
  label: string
  weight: number
  criteriaKo: string
}

export const WRITING_RUBRIC_DEFINITIONS: Record<WritingTaskFormat, WritingRubricDefinition[]> = {
  sentence_practice: [
    { key: 'taskAchievement', label: '과제 수행', weight: 25, criteriaKo: '문제가 요구한 내용/조건(목표 단어, 분량, 상황)을 충족했는가' },
    { key: 'contentDevelopment', label: '내용 전개', weight: 20, criteriaKo: '생각이 구체적으로 표현되고 문장 간 내용이 이어지는가' },
    { key: 'sentenceStructure', label: '문장 구조·다양성', weight: 15, criteriaKo: '문장이 완결되고 단조로운 반복 없이 구조가 다양한가' },
    { key: 'grammar', label: '문법 정확성', weight: 15, criteriaKo: '시제·수일치·관사·전치사 등 기본 문법의 정확성' },
    { key: 'vocabulary', label: '어휘 사용', weight: 12, criteriaKo: '레벨에 맞는 어휘 선택과 목표 word set 활용도' },
    { key: 'cohesion', label: '문장 연결·흐름', weight: 8, criteriaKo: '연결어와 대명사 사용이 자연스럽고 흐름이 매끄러운가' },
    { key: 'mechanics', label: '철자·문장부호', weight: 5, criteriaKo: '철자, 대소문자, 마침표/쉼표 등 표기의 정확성' },
  ],
  academic_essay: [
    { key: 'taskAchievement', label: '과제 수행(Task Response)', weight: 25, criteriaKo: '질문의 모든 요구사항에 답했고 입장이 명확한가' },
    { key: 'organization', label: '글 구성(서론-본론-결론)', weight: 20, criteriaKo: '문단 구분이 명확하고 문단마다 하나의 중심 생각을 유지하는가' },
    { key: 'development', label: '내용 전개·근거(PEEL)', weight: 20, criteriaKo: '주장에 대한 근거와 구체적 예시, 설명이 충분한가' },
    { key: 'cohesion', label: '응집성·연결어', weight: 10, criteriaKo: '연결어가 다양하고 정확하며 결론이 서론과 연결되는가' },
    { key: 'grammar', label: '문법 정확성', weight: 12, criteriaKo: '복문·시제·수일치 등의 정확성과 의미 전달 지장 여부' },
    { key: 'vocabulary', label: '어휘·표현', weight: 8, criteriaKo: '학술적 어휘, collocation, 단어 반복 회피' },
    { key: 'mechanics', label: '철자·문장부호', weight: 5, criteriaKo: '철자, 대소문자, 문장부호 표기의 정확성' },
  ],
}

export type WritingRubricItem = {
  key: string
  label: string
  /** 항목 가중치 (0~100, 전체 항목 합 100) */
  weight: number
  /** 항목 자체 점수 (0~100점 만점 채점, 가중치와 무관) */
  score: number
  /** 해당 항목에 대한 한국어 평가 (2~3문장) */
  comment: string
}

/** 항목이 전체 100점 총점에 실제로 기여하는 점수 (score × weight ÷ 100) */
export function rubricItemContribution(item: WritingRubricItem): number {
  return (item.score * item.weight) / 100
}

export type WritingGradeBand = {
  grade: string
  label: string
  color: string
}

export type WritingOverallEvaluation = {
  /** 항목 획득 점수 합계 (0~100) */
  totalPoints: number
  /** 종합 등급 (A~F) */
  grade: string
  /** 종합 총평 (3~5문장) */
  summaryKo: string
  strongestArea: string
  weakestArea: string
  priorityAction: string
}

export function getWritingGradeBand(totalPoints: number): WritingGradeBand {
  if (totalPoints >= 90) return { grade: 'A', label: '우수', color: '#1FAF54' }
  if (totalPoints >= 80) return { grade: 'B', label: '양호', color: '#1865F2' }
  if (totalPoints >= 70) return { grade: 'C', label: '보통', color: '#FFB100' }
  if (totalPoints >= 60) return { grade: 'D', label: '노력 필요', color: '#E35C20' }
  return { grade: 'F', label: '미흡', color: '#D92916' }
}

export function getRubricItemGradeLabel(score: number): string {
  if (score >= 90) return '우수'
  if (score >= 75) return '양호'
  if (score >= 60) return '보통'
  return '미흡'
}

// ── academic_essay 전용 심화 분석 ──────────────────────────────────────────────

export type WritingQuestionAnalysis = {
  topic: string
  taskRequirements: string[]
  opinionRequired: boolean
  evidenceRequired: boolean
}

export type WritingTaskCoverageItem = {
  requirement: string
  covered: boolean
  note: string
}

export type WritingStructureParagraph = {
  /** Introduction / Body 1 / Body 2 / Conclusion 등 */
  role: string
  mainIdea: string
  onTopic: boolean
  note: string
}

export type WritingPeelElement = {
  present: boolean
  quote: string
}

export type WritingPeelAnalysis = {
  paragraph: string
  point: WritingPeelElement
  evidence: WritingPeelElement & { quality: 'vague' | 'specific' }
  explanation: WritingPeelElement
  link: WritingPeelElement
  note: string
}

export type WritingSentenceVariety = {
  simple: number
  compound: number
  complex: number
  relativeClause: number
  participial: number
  note: string
}

export type WritingCohesiveDevices = {
  used: string[]
  overused: string[]
  missingCategories: string[]
  note: string
}

export type WritingRevisionChecklistItem = {
  item: string
  passed: boolean
  note: string
}

export type WritingImprovedParagraphSample = {
  targetParagraph: string
  before: string
  after: string
  whatChangedKo: string
}

export type WritingEssayAnalysis = {
  questionAnalysis: WritingQuestionAnalysis
  taskCoverage: WritingTaskCoverageItem[]
  structureMap: WritingStructureParagraph[]
  peelAnalysis: WritingPeelAnalysis[]
  sentenceVariety: WritingSentenceVariety
  cohesiveDevices: WritingCohesiveDevices
  revisionChecklist: WritingRevisionChecklistItem[]
  improvedParagraphSample: WritingImprovedParagraphSample
}

// 평가항목별 배점 채점 + 오류 상세분석 채점 리포트
export type WritingGradingReport = {
  detectedTaskFormat?: WritingTaskFormat
  overallScore: number
  cefrEstimate: string
  categoryScores: WritingCategoryScores
  /** 평가항목별 배점/획득점수/항목 평가 */
  rubricItems?: WritingRubricItem[]
  /** 종합 총평 및 성적 */
  overallEvaluation?: WritingOverallEvaluation
  wordCount: number
  strengths: string[]
  errors: WritingError[]
  spellingErrorSummary: SpellingErrorSummaryItem[]
  grammarErrorSummary: GrammarErrorSummaryItem[]
  improvedVersion: string
  teacherNote: string
  nextStepRecommendation: string
  /** academic_essay로 판별된 경우에만 채워짐 */
  essayAnalysis?: WritingEssayAnalysis | null
}

/** rubricItems 가중합계 (Σ score×weight÷100, 반올림). AI가 합계를 잘못 계산해도 UI 표시는 이 값으로 맞춘다. */
export function sumRubricPoints(items: WritingRubricItem[]): number {
  const raw = items.reduce((sum, item) => sum + (Number.isFinite(item.score) ? rubricItemContribution(item) : 0), 0)
  return Math.round(raw)
}

// ── 채점 결과 검증/정규화 ────────────────────────────────────────────────────────
// AI 응답은 프롬프트 지시를 어길 수 있다 (예: rubricItems 가중합계와 overallEvaluation.totalPoints가
// 다르거나, score가 0~100 범위를 벗어나거나, weight를 임의로 바꾸거나,
// 오류가 없는데도 errors에 억지 항목을 채워 넣는 경우).
// 화면/DB에 반영되기 전에 서버에서 항상 아래 정규화를 거쳐 점수 신뢰성을 보장한다.

export type NormalizableRubricReport = {
  detectedTaskFormat?: WritingTaskFormat
  rubricItems?: WritingRubricItem[]
  overallEvaluation?: WritingOverallEvaluation
  categoryScores?: WritingCategoryScores
}

function clampScore(value: number, max = 100): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(max, Math.round(value)))
}

/** errors 배열에서 "오류 없음"을 오류인 것처럼 채워 넣은 무의미한 항목을 제거한다. */
export function stripNonErrors(errors: WritingError[]): WritingError[] {
  return errors.filter((err) => {
    const original = err.original?.trim() ?? ''
    const corrected = err.corrected?.trim() ?? ''
    if (original.length === 0) return false
    if (original === corrected) return false
    const noErrorMarkers = ['오류가 발견되지 않았습니다', '문법적으로 맞습니다', '오류가 없습니다', '틀린 부분이 없습니다']
    if (noErrorMarkers.some((marker) => err.explanationKo?.includes(marker) || err.whyItsWrong?.includes(marker))) {
      return false
    }
    return true
  })
}

/**
 * rubricItems/overallEvaluation/categoryScores를 가진 보고서를 정규화한다.
 * - score를 [0, 100] 범위로 클램프 + 정수 반올림
 * - weight는 AI가 임의로 바꿀 수 없도록 detectedTaskFormat에 대응하는 평가항목표의 고정값으로 덮어쓴다
 * - overallEvaluation.totalPoints/grade를 실제 rubricItems 가중합계 기준으로 재계산 (AI가 준 값은 무시)
 * - categoryScores를 0~100 범위로 클램프
 */
export function normalizeRubricScoring<T extends NormalizableRubricReport>(report: T): T {
  const categoryScores = report.categoryScores
    ? (Object.fromEntries(
        Object.entries(report.categoryScores).map(([key, value]) => [key, clampScore(value as number)]),
      ) as WritingCategoryScores)
    : report.categoryScores

  if (!report.rubricItems || report.rubricItems.length === 0) {
    return { ...report, categoryScores }
  }

  const defs = report.detectedTaskFormat ? WRITING_RUBRIC_DEFINITIONS[report.detectedTaskFormat] : null
  const rubricItems = report.rubricItems.map((item) => {
    const def = defs?.find((d) => d.key === item.key)
    return {
      ...item,
      score: clampScore(item.score),
      weight: def ? def.weight : clampScore(item.weight),
    }
  })
  const totalPoints = sumRubricPoints(rubricItems)
  const band = getWritingGradeBand(totalPoints)
  const overallEvaluation = report.overallEvaluation
    ? { ...report.overallEvaluation, totalPoints, grade: band.grade }
    : report.overallEvaluation

  return { ...report, rubricItems, overallEvaluation, categoryScores }
}

/**
 * WritingGradingReport(교사 채점, 적응형 배치테스트 공용) 전용 정규화.
 * - rubricItems 기준으로 overallScore를 재계산해 rubricItems 합계와 항상 일치시킨다.
 * - wordCount는 AI가 종종 잘못 세므로, 실제 원문에서 계산한 값(actualWordCount)이 있으면 그 값으로 덮어쓴다.
 * - errors에서 "오류 아님"을 오류처럼 채워 넣은 무의미한 항목을 제거한다.
 */
export function normalizeWritingGradingReport(
  report: WritingGradingReport,
  actualWordCount?: number,
): WritingGradingReport {
  const scoreNormalized = normalizeRubricScoring(report)
  const totalPoints = scoreNormalized.overallEvaluation?.totalPoints
  return {
    ...scoreNormalized,
    overallScore: totalPoints ?? clampScore(scoreNormalized.overallScore),
    wordCount: actualWordCount ?? scoreNormalized.wordCount,
    errors: stripNonErrors(scoreNormalized.errors ?? []),
  }
}

/** 원문 텍스트에서 실제 단어 수를 계산한다 (공백 기준 분리). */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ── 프롬프트 ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `너는 학생이 제출한 영어 작문을 분석하여, 교사와 학원장이 신뢰할 수 있는 수준의 정확하고 건설적인 채점 리포트를 생성하는 영어 교육 평가 전문가야.

## taskFormat 판별 (가장 먼저 수행)
- "sentence_practice": 문장/짧은 단락 쓰기 연습 (CEFR 레벨별 word set 활용 문제, 일기/묘사/짧은 답변형 등, 보통 목표 단어 수 150워드 이하)
- "academic_essay": 논술/에세이형 과제 (Task Response가 명시된 문제, 찬반/장단점/비교 등 구조화된 논증이 필요한 과제, 보통 목표 단어 수 150워드 이상)
- 입력에 taskFormat이 명시되지 않으면 문제(prompt)의 성격과 목표 단어 수로 판단하고, 판단 결과를 반드시 detectedTaskFormat에 기록한다.

## 공통 원칙 (모든 taskFormat에 적용)
1. 문법이 완벽해도 논리/구성이 없으면 낮게, 문법이 다소 부족해도 논리가 탄탄하면 상대적으로 높게 평가한다. 과제 수행/구성/내용 전개가 문법보다 채점 우선순위가 높다(배점에도 반영되어 있다).
2. 모든 오류는 4단계 구조로 설명한다: ① 틀린 표현(original) ② 맞는 표현(corrected) ③ 왜 틀렸는지(whyItsWrong) ④ 암기 팁(howToRemember). 여기에 detailedExplanationKo(자연스러운 문단 설명)와 similarCorrectExamples(올바른 예문 2개)를 추가한다.
3. 철자(spelling)와 문법(grammar) 오류는 명확히 구분해 집계한다(spellingErrorSummary / grammarErrorSummary).
   - 철자 오류: 단어 표기 자체가 틀린 경우 (예: "recieve" → "receive")
   - 문법 오류: 시제, 수 일치, 관사, 전치사, 어순 등 (예: "He go" → "He goes")
4. 같은 유형 오류가 반복되면 errors에는 대표 사례만 넣고 occurrenceCount와 otherOccurrences(반복 위치 인용)로 압축한다. errors는 지정된 최대 개수까지만 상세히 다루고 초과분은 summary로만 집계한다.
4-1. errors 배열에는 실제로 틀린 부분만 넣는다. original과 corrected가 같은 문장이거나, "오류가 발견되지 않았습니다"/"문법적으로 맞습니다"처럼 오류가 아니라고 설명하는 항목은 절대 넣지 않는다. 학생 답안에 실제 오류가 전혀 없다면 errors는 빈 배열([])로 반환한다. 오류 개수를 채우기 위해 없는 오류를 만들어내지 않는다.
5. CEFR 레벨/목표 밴드에 따라 엄격도를 조절한다: 낮은 레벨(A1-A2)은 핵심 오류 위주로 관대하게, 높은 레벨(B2-C1)은 collocation·격식체·뉘앙스까지 짚는다.
6. 항상 격려하는 톤을 유지하고 strengths를 최소 1개 이상 구체적으로 제시한다.
7. 원문에 없는 내용을 임의로 추가해 오류로 지적하지 않는다.
8. 원어민 관점의 자연스러움과 학습자 영어(learner English)의 허용 범위를 구분한다. 문법적으로 틀리지 않았지만 어색한 표현은 "minor" 심각도의 vocabulary 오류로 분류하고 실제 문법 규칙 위반과 섞지 않는다.
9. 출력은 지정된 JSON 스키마만 반환한다. 부가 설명, 마크다운 코드블록 표시(\`\`\`) 없이 순수 JSON만 반환한다.

## 종합 총평 및 성적 산출 규칙 (필수)
1. 판별한 taskFormat에 해당하는 평가항목표를 그대로 사용한다. 항목을 추가/삭제하지 않는다.
2. 각 항목은 그 자체로 0~100점 만점으로 독립 채점한다(score). 배점(weight)이 작은 항목이라고 해서 낮은 만점 기준으로 채점하지 않는다 — 예를 들어 weight 5%인 "철자·문장부호" 항목도 철자가 완벽하면 100점을 줄 수 있다. weight는 그 항목이 전체 총점에서 차지하는 비중(%)일 뿐, 항목 자체의 만점이 아니다. weight 값은 평가항목표에 정의된 값을 그대로 사용하고 임의로 바꾸지 않는다.
3. 각 항목마다 comment(한국어 2~3문장)를 작성한다. comment에는 반드시 (가) 왜 그 점수(100점 만점 기준)인지 원문 근거를 인용하고 (나) 100점에 가까워지려면 무엇을 해야 하는지를 포함한다.
4. overallEvaluation.totalPoints(전체 총점, 0~100)는 모든 항목의 (score × weight ÷ 100)을 더한 가중평균이다. overallScore도 같은 값으로 둔다. rubricItems를 모두 채운 뒤 반드시 각 항목의 (score × weight ÷ 100)을 계산해 손으로 더하고, 그 합계를 반올림한 값을 totalPoints/overallScore에 넣는다. (예: 문법 score 80점 × weight 12% = 12점 만점 중 9.6점 기여)
5. grade는 totalPoints 기준으로 A(90~100) / B(80~89) / C(70~79) / D(60~69) / F(0~59) 중 하나를 부여한다.
6. summaryKo(종합 총평, 3~5문장)는 항목별 점수 결과와 일관되게 작성한다. 점수가 낮은 항목을 총평에서 칭찬하거나, 점수가 높은 항목을 총평에서 문제 삼지 않는다.
7. categoryScores(0~100)는 기존 리포트 호환용 지표이므로 항목 점수와 모순되지 않게 환산해 채운다.
8. taskCoverage(academic_essay) 또는 문제 요구사항 중 하나라도 충족하지 못했다면, taskAchievement(또는 과제 수행 항목)의 score는 반드시 60점 이하로 채점한다. 요구사항을 다 충족했다고 판정했으면서 과제 수행 점수를 크게 깎지 않는다 (반대의 경우도 금지 — 모두 충족했는데 낮게 주지 않는다).

## academic_essay일 때만 추가 적용 (essayAnalysis)
0. detectedTaskFormat이 academic_essay이면 essayAnalysis는 절대 생략할 수 없는 필수 필드다. 항상 questionAnalysis/taskCoverage/structureMap/peelAnalysis/sentenceVariety/cohesiveDevices/revisionChecklist/improvedParagraphSample을 모두 채워서 반환한다. sentence_practice일 때만 essayAnalysis를 null로 둔다.
1. 채점 전 질문(prompt)을 분석해 questionAnalysis를 구조화한다: Topic, Task requirements, Opinion 필요 여부, 근거/예시 필수 여부. 학생 답안이 요구사항을 모두 충족했는지 taskCoverage에서 항목별 covered true/false로 판정한다. 하나라도 false면 과제 수행 항목 점수와 총점에 크게 반영한다.
2. structureMap으로 Introduction/Body.../Conclusion 각 문단의 중심 생각과 주제 이탈(topic jumping) 여부를 판정한다.
3. Body 문단마다 peelAnalysis(Point/Evidence/Explanation/Link 각 요소의 존재 여부와 인용, 예시 품질 vague/specific)를 수행한다.
4. sentenceVariety(simple/compound/complex/관계절/분사구문 문장 수)와 cohesiveDevices(사용된 연결어, 과다 반복 연결어, 미사용 카테고리)를 분석한다.
5. revisionChecklist 7개 항목(질문에 모두 답했는가 / 문단당 하나의 중심 생각인가 / 근거가 있는가 / 단어 반복이 없는가 / 문법 오류가 심각하지 않은가 / 연결어가 자연스러운가 / 결론이 서론과 연결되는가)을 passed true/false로 판정한다.
6. improvedParagraphSample로 가장 약한 문단 하나를 PEEL 구조 보완 버전으로 제시한다.
7. sentence_practice로 판별한 경우 essayAnalysis는 null로 둔다.`

function formatRubricTable(format: WritingTaskFormat): string {
  return WRITING_RUBRIC_DEFINITIONS[format]
    .map((r) => `- ${r.key} (${r.label}) / 가중치 ${r.weight}% — ${r.criteriaKo}`)
    .join('\n')
}

/** 두 taskFormat의 평가항목표 (프롬프트 공용 블록) */
export function buildRubricGuideBlock(): string {
  return `### sentence_practice 평가항목 (항목별 100점 만점 채점, 가중치 합 100%)
${formatRubricTable('sentence_practice')}

### academic_essay 평가항목 (항목별 100점 만점 채점, 가중치 합 100%)
${formatRubricTable('academic_essay')}`
}

/** 평가항목/종합총평 JSON 스키마 (프롬프트 공용 블록) */
export function buildRubricSchemaBlock(): string {
  return `"detectedTaskFormat": "sentence_practice | academic_essay (판별 결과)",
  "rubricItems": [
    {
      "key": "평가항목표의 key 그대로",
      "label": "평가항목표의 label 그대로",
      "weight": 평가항목표의 가중치(%) 그대로,
      "score": 이 항목 자체를 100점 만점 기준으로 채점한 점수 (0~100 정수, weight와 무관하게 채점),
      "comment": "이 항목에 대한 한국어 평가 2~3문장 (원문 근거 인용 + 100점에 가까워지는 방법)"
    }
  ],
  "overallEvaluation": {
    "totalPoints": 모든 rubricItems의 (score × weight ÷ 100)을 더한 가중평균, 반올림한 정수 (0~100),
    "grade": "A | B | C | D | F (totalPoints 기준)",
    "summaryKo": "종합 총평 3~5문장 (항목별 점수와 일관되게, 격려 톤)",
    "strongestArea": "가장 점수가 높은 평가항목 label과 그 이유 한 문장",
    "weakestArea": "가장 점수가 낮은 평가항목 label과 그 이유 한 문장",
    "priorityAction": "다음 작문에서 가장 먼저 고쳐야 할 한 가지"
  }`
}

/** academic_essay 심화 분석 JSON 스키마 (프롬프트 공용 블록) */
export function buildEssayAnalysisSchema(): string {
  return `"essayAnalysis": detectedTaskFormat이 "academic_essay"이면 이 필드는 반드시 아래 형태로 채워야 한다 (필수, 생략 금지). "sentence_practice"이면 null.
  {
    "questionAnalysis": {
      "topic": "질문의 주제",
      "taskRequirements": ["질문이 요구한 과제 1", "과제 2"],
      "opinionRequired": true 또는 false,
      "evidenceRequired": true 또는 false
    },
    "taskCoverage": [
      { "requirement": "요구사항", "covered": true 또는 false, "note": "충족/미충족 근거 한 문장" }
    ],
    "structureMap": [
      { "role": "Introduction | Body 1 | Body 2 | Conclusion", "mainIdea": "해당 문단의 중심 생각", "onTopic": true 또는 false, "note": "주제 이탈 여부 설명" }
    ],
    "peelAnalysis": [
      {
        "paragraph": "Body 1",
        "point": { "present": true 또는 false, "quote": "원문 인용" },
        "evidence": { "present": true 또는 false, "quote": "원문 인용", "quality": "vague | specific" },
        "explanation": { "present": true 또는 false, "quote": "원문 인용" },
        "link": { "present": true 또는 false, "quote": "원문 인용" },
        "note": "보완할 점 한 문장"
      }
    ],
    "sentenceVariety": {
      "simple": 개수, "compound": 개수, "complex": 개수,
      "relativeClause": 개수, "participial": 개수,
      "note": "문장 구조 분포에 대한 한국어 평가 한두 문장"
    },
    "cohesiveDevices": {
      "used": ["사용된 연결어"],
      "overused": ["과도하게 반복된 연결어"],
      "missingCategories": ["미사용 연결어 카테고리 (예: 대조, 예시, 인과)"],
      "note": "연결어 사용에 대한 한국어 평가 한두 문장"
    },
    "revisionChecklist": [
      { "item": "질문에 모두 답했는가", "passed": true 또는 false, "note": "판정 근거" }
    ],
    "improvedParagraphSample": {
      "targetParagraph": "보완 대상 문단 (예: Body 2)",
      "before": "원문 문단 그대로",
      "after": "PEEL 구조로 보완한 영어 문단",
      "whatChangedKo": "무엇을 어떻게 바꿨는지 한국어 설명"
    }
  }`
}

function buildOutputSchema(): string {
  return `{
  ${buildRubricSchemaBlock()},
  "overallScore": overallEvaluation.totalPoints와 동일한 값 (0~100 정수),
  "cefrEstimate": "실제 작문 수준에서 추정되는 CEFR 레벨 (예: B1)",
  "categoryScores": {
    "grammar": 0-100,
    "spelling": 0-100,
    "vocabulary": 0-100,
    "sentenceStructure": 0-100,
    "coherence": 0-100,
    "taskAchievement": 0-100
  },
  "wordCount": 실제 단어 수,
  "strengths": [
    "학생이 잘한 점 구체적 서술 (한국어, 1~3개)"
  ],
  "errors": [
    {
      "type": "grammar | spelling | vocabulary | punctuation | sentenceStructure",
      "subType": "예: 시제, 수일치, 관사, 전치사, 철자, 어순, collocation 등",
      "original": "틀린 표현 (원문 그대로 인용)",
      "corrected": "맞는 표현",
      "explanationKo": "한 줄 요약 설명",
      "whyItsWrong": "왜 틀렸는지 (규칙 중심 설명)",
      "howToRemember": "암기 팁",
      "detailedExplanationKo": "자연스러운 문단 형태의 상세 설명 (2~3문장)",
      "similarCorrectExamples": ["올바른 예문 1", "올바른 예문 2"],
      "severity": "minor | moderate | major",
      "occurrenceCount": 동일 유형 오류가 반복된 총 횟수 (기본 1),
      "otherOccurrences": ["같은 유형이 반복된 다른 위치 인용 (없으면 빈 배열)"]
    }
  ],
  "spellingErrorSummary": [
    { "misspelled": "틀린 단어", "correct": "올바른 철자", "occurrenceCount": 횟수 }
  ],
  "grammarErrorSummary": [
    { "category": "시제 | 수일치 | 관사 | 전치사 | 어순 | 기타", "count": 해당 카테고리 오류 개수, "examples": ["대표 예시 1~2개"] }
  ],
  "improvedVersion": "학생 원문의 의도와 어휘 수준은 최대한 유지하되, 지적한 오류만 수정한 전체 버전 (Before/After 비교 학습용)",
  "teacherNote": "담당 교사에게 전달할 1~2문장 요약 (강점/약점 패턴, 다음 학습 포인트). 분량이 목표에 미달했다면 여기에 언급",
  "nextStepRecommendation": "학생에게 줄 다음 학습 추천 (예: 관사 집중 연습, 특정 word set 복습 등)",
  ${buildEssayAnalysisSchema()}
}`
}

export type WritingGradingPromptInput = {
  cefrLevel: string
  writingPrompt: string
  targetWordCount: number | null
  studentSubmission: string
  taskFormat?: WritingTaskFormat | null
  maxErrorCount?: number
}

export function buildWritingGradingSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildWritingGradingUserPrompt(input: WritingGradingPromptInput): string {
  const {
    cefrLevel,
    writingPrompt,
    targetWordCount,
    studentSubmission,
    taskFormat = null,
    maxErrorCount = 10,
  } = input

  return `## 입력 정보
- 학생 CEFR 레벨/목표 밴드: ${cefrLevel}
- taskFormat: ${taskFormat ?? '미지정 (문제 성격과 목표 단어 수로 직접 판별할 것)'}
- 문제/주제(prompt): ${writingPrompt}
- 목표 단어 수: ${targetWordCount !== null ? `${targetWordCount}단어` : '지정되지 않음 (해당 레벨에서 통상적으로 기대되는 분량 기준으로 과제 수행 평가)'}
- errors 최대 상세 개수: ${maxErrorCount}개 (초과분은 spellingErrorSummary/grammarErrorSummary로만 집계)
- 학생 답안: ${studentSubmission}

## 평가항목표 (판별한 taskFormat의 표를 그대로 사용, 배점 변경 금지)
${buildRubricGuideBlock()}

## 출력 JSON 스키마
${buildOutputSchema()}`
}

// ── OpenAI Structured Outputs (strict JSON Schema) ─────────────────────────────
// json_object 모드는 필드 설명을 텍스트로만 지시하므로, 모델이 필수 필드(특히 essayAnalysis)를
// 통째로 누락해도 유효한 JSON으로 통과해버린다. strict 모드는 스키마에 선언된 키가 항상
// 존재하도록(값이 필요하면 null) 구조적으로 강제하므로, 응답 검증 대신 응답 생성 단계에서 막는다.

const PEEL_ELEMENT_SCHEMA = {
  type: 'object',
  properties: {
    present: { type: 'boolean' },
    quote: { type: 'string' },
  },
  required: ['present', 'quote'],
  additionalProperties: false,
} as const

const ERROR_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['grammar', 'spelling', 'vocabulary', 'punctuation', 'sentenceStructure'] },
    subType: { type: 'string' },
    original: { type: 'string' },
    corrected: { type: 'string' },
    explanationKo: { type: 'string' },
    whyItsWrong: { type: 'string' },
    howToRemember: { type: 'string' },
    detailedExplanationKo: { type: 'string' },
    similarCorrectExamples: { type: 'array', items: { type: 'string' } },
    severity: { type: 'string', enum: ['minor', 'moderate', 'major'] },
    occurrenceCount: { type: 'integer' },
    otherOccurrences: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'type', 'subType', 'original', 'corrected', 'explanationKo', 'whyItsWrong',
    'howToRemember', 'detailedExplanationKo', 'similarCorrectExamples', 'severity',
    'occurrenceCount', 'otherOccurrences',
  ],
  additionalProperties: false,
} as const

const RUBRIC_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    label: { type: 'string' },
    weight: { type: 'integer' },
    score: { type: 'integer' },
    comment: { type: 'string' },
  },
  required: ['key', 'label', 'weight', 'score', 'comment'],
  additionalProperties: false,
} as const

const OVERALL_EVALUATION_SCHEMA = {
  type: 'object',
  properties: {
    totalPoints: { type: 'integer' },
    grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
    summaryKo: { type: 'string' },
    strongestArea: { type: 'string' },
    weakestArea: { type: 'string' },
    priorityAction: { type: 'string' },
  },
  required: ['totalPoints', 'grade', 'summaryKo', 'strongestArea', 'weakestArea', 'priorityAction'],
  additionalProperties: false,
} as const

const CATEGORY_SCORES_SCHEMA = {
  type: 'object',
  properties: {
    grammar: { type: 'integer' },
    spelling: { type: 'integer' },
    vocabulary: { type: 'integer' },
    sentenceStructure: { type: 'integer' },
    coherence: { type: 'integer' },
    taskAchievement: { type: 'integer' },
  },
  required: ['grammar', 'spelling', 'vocabulary', 'sentenceStructure', 'coherence', 'taskAchievement'],
  additionalProperties: false,
} as const

const ESSAY_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    questionAnalysis: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        taskRequirements: { type: 'array', items: { type: 'string' } },
        opinionRequired: { type: 'boolean' },
        evidenceRequired: { type: 'boolean' },
      },
      required: ['topic', 'taskRequirements', 'opinionRequired', 'evidenceRequired'],
      additionalProperties: false,
    },
    taskCoverage: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          requirement: { type: 'string' },
          covered: { type: 'boolean' },
          note: { type: 'string' },
        },
        required: ['requirement', 'covered', 'note'],
        additionalProperties: false,
      },
    },
    structureMap: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          mainIdea: { type: 'string' },
          onTopic: { type: 'boolean' },
          note: { type: 'string' },
        },
        required: ['role', 'mainIdea', 'onTopic', 'note'],
        additionalProperties: false,
      },
    },
    peelAnalysis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          paragraph: { type: 'string' },
          point: PEEL_ELEMENT_SCHEMA,
          evidence: {
            type: 'object',
            properties: {
              present: { type: 'boolean' },
              quote: { type: 'string' },
              quality: { type: 'string', enum: ['vague', 'specific'] },
            },
            required: ['present', 'quote', 'quality'],
            additionalProperties: false,
          },
          explanation: PEEL_ELEMENT_SCHEMA,
          link: PEEL_ELEMENT_SCHEMA,
          note: { type: 'string' },
        },
        required: ['paragraph', 'point', 'evidence', 'explanation', 'link', 'note'],
        additionalProperties: false,
      },
    },
    sentenceVariety: {
      type: 'object',
      properties: {
        simple: { type: 'integer' },
        compound: { type: 'integer' },
        complex: { type: 'integer' },
        relativeClause: { type: 'integer' },
        participial: { type: 'integer' },
        note: { type: 'string' },
      },
      required: ['simple', 'compound', 'complex', 'relativeClause', 'participial', 'note'],
      additionalProperties: false,
    },
    cohesiveDevices: {
      type: 'object',
      properties: {
        used: { type: 'array', items: { type: 'string' } },
        overused: { type: 'array', items: { type: 'string' } },
        missingCategories: { type: 'array', items: { type: 'string' } },
        note: { type: 'string' },
      },
      required: ['used', 'overused', 'missingCategories', 'note'],
      additionalProperties: false,
    },
    revisionChecklist: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          passed: { type: 'boolean' },
          note: { type: 'string' },
        },
        required: ['item', 'passed', 'note'],
        additionalProperties: false,
      },
    },
    improvedParagraphSample: {
      type: 'object',
      properties: {
        targetParagraph: { type: 'string' },
        before: { type: 'string' },
        after: { type: 'string' },
        whatChangedKo: { type: 'string' },
      },
      required: ['targetParagraph', 'before', 'after', 'whatChangedKo'],
      additionalProperties: false,
    },
  },
  required: [
    'questionAnalysis', 'taskCoverage', 'structureMap', 'peelAnalysis',
    'sentenceVariety', 'cohesiveDevices', 'revisionChecklist', 'improvedParagraphSample',
  ],
  additionalProperties: false,
} as const

/**
 * WritingGradingReport용 strict JSON Schema (OpenAI Structured Outputs).
 * essayAnalysis는 detectedTaskFormat이 sentence_practice일 때 null이 되어야 하므로
 * anyOf[객체, null]로 선언한다 — 그 외 필드는 항상 값이 있어야 하므로 nullable로 두지 않는다.
 */
export const WRITING_GRADING_JSON_SCHEMA = {
  type: 'object',
  properties: {
    detectedTaskFormat: { type: 'string', enum: ['sentence_practice', 'academic_essay'] },
    overallScore: { type: 'integer' },
    cefrEstimate: { type: 'string' },
    categoryScores: CATEGORY_SCORES_SCHEMA,
    rubricItems: { type: 'array', items: RUBRIC_ITEM_SCHEMA },
    overallEvaluation: OVERALL_EVALUATION_SCHEMA,
    wordCount: { type: 'integer' },
    strengths: { type: 'array', items: { type: 'string' } },
    errors: { type: 'array', items: ERROR_ITEM_SCHEMA },
    spellingErrorSummary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          misspelled: { type: 'string' },
          correct: { type: 'string' },
          occurrenceCount: { type: 'integer' },
        },
        required: ['misspelled', 'correct', 'occurrenceCount'],
        additionalProperties: false,
      },
    },
    grammarErrorSummary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          count: { type: 'integer' },
          examples: { type: 'array', items: { type: 'string' } },
        },
        required: ['category', 'count', 'examples'],
        additionalProperties: false,
      },
    },
    improvedVersion: { type: 'string' },
    teacherNote: { type: 'string' },
    nextStepRecommendation: { type: 'string' },
    essayAnalysis: { anyOf: [ESSAY_ANALYSIS_SCHEMA, { type: 'null' }] },
  },
  required: [
    'detectedTaskFormat', 'overallScore', 'cefrEstimate', 'categoryScores', 'rubricItems',
    'overallEvaluation', 'wordCount', 'strengths', 'errors', 'spellingErrorSummary',
    'grammarErrorSummary', 'improvedVersion', 'teacherNote', 'nextStepRecommendation', 'essayAnalysis',
  ],
  additionalProperties: false,
} as const

/** getAiAnalysis/gradeAdaptiveWriting 등에서 OpenAI Chat Completions 호출 시 response_format으로 그대로 전달 */
export function buildWritingGradingResponseFormat() {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: 'writing_grading_report',
      strict: true,
      schema: WRITING_GRADING_JSON_SCHEMA,
    },
  }
}
