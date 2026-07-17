// 쓰기 채점 AI 공용 스키마/프롬프트 (교사 채점, 학생 쓰기연습 공통 사용)

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
  original: string
  corrected: string
  explanationKo: string
  severity: WritingErrorSeverity
  occurrenceCount: number
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

// 6영역(문법/철자/어휘/문장구조/응집성/과제수행도) 상세 오류분석 채점 리포트
export type WritingGradingReport = {
  overallScore: number
  cefrEstimate: string
  categoryScores: WritingCategoryScores
  wordCount: number
  strengths: string[]
  errors: WritingError[]
  spellingErrorSummary: SpellingErrorSummaryItem[]
  grammarErrorSummary: GrammarErrorSummaryItem[]
  improvedVersion: string
  teacherNote: string
  nextStepRecommendation: string
}

const SYSTEM_PROMPT = `너는 학생이 제출한 영어 작문을 분석하여, 교사와 학원장이 신뢰할 수 있는 수준의 정확하고 건설적인 채점 리포트를 생성하는 영어 교육 평가 전문가야.

## 역할과 원칙
1. 문법(Grammar), 철자(Spelling), 어휘(Vocabulary), 문장 구조(Sentence Structure), 과제 수행도(Task Achievement), 응집성(Coherence)의 6개 영역을 평가한다.
2. 모든 오류는 원문에서 정확한 위치(원본 텍스트 그대로)를 인용하고, 수정안과 "왜 틀렸는지"에 대한 한국어 설명을 함께 제공한다. 설명은 학생이 이해하기 쉽도록 해당 CEFR 레벨에 맞는 문법 용어 난이도를 사용한다.
3. 오류를 지적할 때 비난조가 아닌 격려하는 톤을 유지한다. 잘 쓴 표현이나 시도는 반드시 최소 1개 이상 구체적으로 칭찬한다.
4. CEFR 레벨이 낮을수록(A1-A2) 관대하게 채점하고 핵심 오류 위주로 짚어준다. 레벨이 높을수록(B2-C1) 미묘한 뉘앙스, collocation 오류, 격식체 일관성까지 평가한다.
5. 철자 오류와 문법 오류를 명확히 구분한다:
   - 철자 오류(spelling): 단어 자체의 표기가 틀린 경우 (예: "recieve" → "receive")
   - 문법 오류(grammar): 시제, 수 일치, 관사, 전치사, 어순 등 (예: "He go" → "He goes")
6. 같은 오류가 반복되면 처음 1회만 상세 설명하고, 이후 반복은 "동일 유형 오류 N회 반복"으로 묶어서 표시한다 (리포트 가독성을 위해).
7. 채점은 아래 JSON 스키마만 출력한다. JSON 외의 텍스트, 마크다운 코드블록 표시(\`\`\`)를 포함하지 않는다.

## 채점 시 유의사항
- 원어민 관점의 자연스러움과 학습자 영어(learner English)의 허용 범위를 구분한다. 문법적으로 틀리지 않았지만 어색한 표현(unnatural but not wrong)은 "minor" 심각도의 vocabulary 오류로 별도 분류하고, 실제 문법 규칙 위반과 섞지 않는다.
- 학생이 목표 단어 수보다 현저히 적게 썼다면 taskAchievement 점수에 반영하되, 그 사실을 errors 배열이 아닌 teacherNote에 언급한다.
- 절대 원문에 없는 문장을 임의로 추가하여 오류로 지적하지 않는다.
- 오류 설명(explanationKo)에는 반드시 "왜"와 "어떻게"를 모두 포함한다. 예: "receive는 'i 앞에 e' 규칙의 예외 단어입니다. i-e 순서로 외워두세요." 처럼 단순 정답 나열이 아닌 학습 포인트를 제공한다.`

function buildOutputSchema(): string {
  return `{
  "overallScore": 0-100 사이 정수,
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
      "original": "원문에서 오류가 포함된 부분 (문장 단위 또는 구 단위로 인용)",
      "corrected": "수정된 표현",
      "explanationKo": "왜 오류인지, 어떻게 고치는지 한국어로 설명",
      "severity": "minor | moderate | major",
      "occurrenceCount": 동일 오류가 반복된 횟수 (기본 1)
    }
  ],
  "spellingErrorSummary": [
    { "misspelled": "틀린 단어", "correct": "올바른 철자", "occurrenceCount": 횟수 }
  ],
  "grammarErrorSummary": [
    { "category": "시제 | 수일치 | 관사 | 전치사 | 어순 | 기타", "count": 해당 카테고리 오류 개수, "examples": ["대표 예시 1~2개"] }
  ],
  "improvedVersion": "학생 원문의 의도와 어휘 수준은 최대한 유지하되, 위에서 지적한 오류만 수정한 전체 버전 (학생이 Before/After로 비교 학습할 수 있도록)",
  "teacherNote": "담당 교사에게 전달할 1~2문장 요약 (학생의 강점/약점 패턴, 다음 학습 포인트)",
  "nextStepRecommendation": "학생에게 줄 다음 학습 추천 (예: 관사 집중 연습, 특정 word set 복습 등)"
}`
}

export type WritingGradingPromptInput = {
  cefrLevel: string
  writingPrompt: string
  targetWordCount: number | null
  studentSubmission: string
}

export function buildWritingGradingSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildWritingGradingUserPrompt(input: WritingGradingPromptInput): string {
  const { cefrLevel, writingPrompt, targetWordCount, studentSubmission } = input
  return `## 입력 정보
- 학생 CEFR 레벨: ${cefrLevel}
- 문제/주제(prompt): ${writingPrompt}
- 목표 단어 수: ${targetWordCount !== null ? targetWordCount : '지정되지 않음 (해당 레벨에서 통상적으로 기대되는 분량 기준으로 taskAchievement 평가)'}
- 학생 답안: ${studentSubmission}

## 출력 JSON 스키마
${buildOutputSchema()}`
}
