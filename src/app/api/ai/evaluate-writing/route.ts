import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

type DomainScore = {
  score: number
  maxForLevel: number
  details: string
}

type WritingCorrection = {
  original: string
  corrected: string
  explanation: string
  category: string
}

type PriorityAction = {
  priority: number
  area: string
  action: string
  detail: string
  weeklyGoal: string
}

export interface WritingEvaluationResult {
  scores: {
    grammar: DomainScore
    organization: DomainScore
    vocabulary: DomainScore
    expression: DomainScore
  }
  totalScore: number
  totalMaxScore: number
  percentage: number
  overallComment: string
  corrections: WritingCorrection[]
  levelUpStrategy: {
    currentLevel: number
    targetLevel: number
    currentWritingAvg: number
    targetScore: number
    gap: number
    estimatedWeeks: number
    priorityActions: PriorityAction[]
    weeklyPlan: string
    encouragement: string
  }
  modelEssay: {
    text: string
    wordCount: number
    keyFeatures: string[]
  }
}

type StudentProfileInput = {
  currentLevel: number
  cefrLevel: string
  grammarAvg: number | null
  vocabAvg: number | null
  readingAvg: number | null
  writingAvg: number | null
  recentWritingScores: number[]
}

type RequestBody = {
  essay: string
  topicTitle: string
  topicPrompt: string
  minWords: number
  maxWords: number
  studentProfile: StudentProfileInput
}

// ── 레벨별 평가 기준 텍스트 ────────────────────────────────────────────────────

function getLevelCriteria(level: number): string {
  const criteria: Record<number, string> = {
    1: `### Level 1 (Pre-A1) 평가 기준:
- 문법: 주어+동사 기본 구조를 사용하는가? be동사, 현재시제 사용이 맞는가?
- 어휘: 기초 단어(가족, 음식, 색상 등)를 올바르게 사용하는가?
- 구성: 2~3개 문장이 연결되어 있는가?
- 표현: 의미 전달이 되는가? (문법 오류가 있어도 의미가 통하면 OK)

중요: Level 1은 입문 단계이므로 칭찬 위주로 평가하고, 1~2가지 핵심 개선점만 제시.`,

    2: `### Level 2 (A1-A2) 평가 기준:
- 문법: 과거시제, 현재진행형을 올바르게 사용하는가? 전치사 사용은?
- 어휘: 일상 주제의 어휘를 적절히 사용하는가? 같은 단어 반복은 없는가?
- 구성: and, but, because로 문장을 연결하는가? 시간 순서가 맞는가?
- 표현: 단순하지만 자연스러운 표현을 사용하는가?`,

    3: `### Level 3 (B1) 평가 기준:
- 문법: 관계대명사, 조건문, 완료시제를 사용할 수 있는가? 주어-동사 일치는?
- 어휘: 주제에 맞는 다양한 어휘를 사용하는가? 동의어/반의어 활용은?
- 구성: 서론-본론-결론 구조가 있는가? 연결어(however, therefore, moreover)를 사용하는가?
- 표현: 자신의 의견을 명확히 표현하는가? 이유와 예시를 들 수 있는가?`,

    4: `### Level 4 (B2) 평가 기준:
- 문법: 복잡한 문장 구조(분사구문, 도치, 가정법)를 사용하는가?
- 어휘: 학술적/추상적 어휘를 적절히 사용하는가? 관용구/숙어 사용은?
- 구성: 논리적 흐름이 일관되는가? 단락 간 전환이 자연스러운가?
- 표현: 비교/대조, 원인/결과를 효과적으로 표현하는가?`,

    5: `### Level 5 (C1-C2) 평가 기준:
- 문법: 네이티브에 가까운 정확도, 미묘한 시제/태 구분
- 어휘: 정교한 어휘 선택, 뉘앙스 구분, 학술적 표현
- 구성: 에세이 구조의 완성도, 논증의 깊이, 비판적 사고
- 표현: 수사적 기법, 독자를 고려한 표현, 문체의 일관성`,
  }
  return criteria[level] ?? criteria[3]
}

// ── 프롬프트 빌더 ──────────────────────────────────────────────────────────────

function buildUserPrompt(body: RequestBody, wordCount: number): string {
  const { essay, topicTitle, topicPrompt, minWords, maxWords, studentProfile } = body
  const { currentLevel, cefrLevel, grammarAvg, vocabAvg, writingAvg, recentWritingScores } =
    studentProfile

  const fmt = (v: number | null) => (v !== null ? `${v}점` : '평가 없음')
  const recentStr =
    recentWritingScores.length > 0 ? recentWritingScores.join(', ') + '점' : '이전 기록 없음'
  const targetLevel = Math.min(currentLevel + 1, 5)
  const currentAvg = writingAvg ?? 0

  return `아래 학생의 영어 에세이를 평가해줘.

## 학생 정보
- 현재 레벨: Level ${currentLevel} (CEFR ${cefrLevel})
- 영역별 점수: Grammar ${fmt(grammarAvg)}, Vocabulary ${fmt(vocabAvg)}, Writing ${fmt(writingAvg)}
- 최근 쓰기 점수 추이: ${recentStr} (최근 ${recentWritingScores.length}회)

## 에세이 정보
- 주제 (한국어): ${topicTitle}
- 주제 (영어): ${topicPrompt}
- 권장 단어 수: ${minWords}~${maxWords}단어
- 실제 단어 수: ${wordCount}단어

## 에세이 원문
${essay}

## 평가 기준
${getLevelCriteria(currentLevel)}

## 응답 형식 (JSON, 반드시 이 구조 그대로)
{
  "scores": {
    "grammar": { "score": 0~10 정수, "maxForLevel": 10, "details": "구체적인 한국어 설명 (1~2문장)" },
    "organization": { "score": 0~10 정수, "maxForLevel": 10, "details": "구체적인 한국어 설명 (1~2문장)" },
    "vocabulary": { "score": 0~10 정수, "maxForLevel": 10, "details": "구체적인 한국어 설명 (1~2문장)" },
    "expression": { "score": 0~10 정수, "maxForLevel": 10, "details": "구체적인 한국어 설명 (1~2문장)" }
  },
  "totalScore": 4개 점수의 합계,
  "totalMaxScore": 40,
  "percentage": 소수점 첫째 자리,
  "overallComment": "전체 총평 2~4문장 (한국어, 학생 레벨 고려, 격려 포함)",
  "corrections": [
    {
      "original": "원문의 오류 있는 문장 또는 구",
      "corrected": "교정된 문장 또는 구",
      "explanation": "왜 틀렸고 어떻게 고쳐야 하는지 한국어로",
      "category": "grammar 또는 vocabulary 또는 expression"
    }
  ],
  "levelUpStrategy": {
    "currentLevel": ${currentLevel},
    "targetLevel": ${targetLevel},
    "currentWritingAvg": ${currentAvg},
    "targetScore": 70,
    "gap": ${Math.max(0, 70 - currentAvg)},
    "estimatedWeeks": 현실적인 예상 주수 (2~12),
    "priorityActions": [
      {
        "priority": 1,
        "area": "가장 약한 영역명 (vocabulary/grammar/organization/expression)",
        "action": "짧은 액션 제목",
        "detail": "구체적이고 실천 가능한 방법 설명 (2~3문장)",
        "weeklyGoal": "이번 주 구체적 목표 (1문장)"
      },
      { "priority": 2, "area": "...", "action": "...", "detail": "...", "weeklyGoal": "..." },
      { "priority": 3, "area": "...", "action": "...", "detail": "...", "weeklyGoal": "..." }
    ],
    "weeklyPlan": "주간 쓰기 학습 플랜 (1~2문장)",
    "encouragement": "학생의 강점을 언급하며 동기를 부여하는 격려 메시지 (1~2문장)"
  },
  "modelEssay": {
    "text": "같은 주제로 Level ${currentLevel}에 맞는 모범 답안 (${minWords}~${maxWords}단어 영어)",
    "wordCount": 모범 답안 단어 수,
    "keyFeatures": ["모범 답안의 핵심 특징 1", "특징 2", "특징 3", "특징 4", "특징 5"]
  }
}

주의사항:
- corrections는 실제 오류가 있는 경우만 포함 (최대 5개). 오류가 없으면 빈 배열 [].
- Level 1~2는 corrections를 1~2개만 제시하고 칭찬을 많이 해줘.
- modelEssay의 text는 반드시 영어로 작성 (해설은 keyFeatures에 한국어로).
- JSON 외 다른 텍스트 절대 금지.`
}

// ── API 핸들러 ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = (await req.json()) as RequestBody

    if (!body.essay || body.essay.trim().length === 0) {
      return NextResponse.json({ error: '에세이 내용이 필요합니다.' }, { status: 400 })
    }

    const wordCount = body.essay.trim().split(/\s+/).filter(Boolean).length

    const systemPrompt = `너는 20년 경력의 한국인 영어 교사야. 한국 영어학원 학생의 영어 에세이를 평가해.
학생의 현재 레벨에 맞는 기준으로 평가해야 해. Level 1 학생에게 Level 5 기준을 적용하면 안 돼.
항상 한국어로 응답하고, 학생이 이해할 수 있는 쉬운 표현으로 설명해.
응답은 반드시 JSON 형식으로만 해. 다른 텍스트 없이.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildUserPrompt(body, wordCount) },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0].message.content
    if (!rawContent) {
      return NextResponse.json({ error: 'AI 응답을 받지 못했습니다.' }, { status: 500 })
    }

    const result = JSON.parse(rawContent) as WritingEvaluationResult
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[evaluate-writing] error:', error)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: error.status ?? 500 },
      )
    }
    return NextResponse.json({ error: 'AI 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
