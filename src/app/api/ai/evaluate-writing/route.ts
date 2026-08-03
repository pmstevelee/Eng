import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import type { DomainLevels } from '@/lib/ai/domain-level-calculator'
import { checkAiUsageLimit, trackAiUsage } from '@/lib/usage/tracker'
import { queueOverageCharge } from '@/lib/usage/overage'
import {
  buildEssayAnalysisSchema,
  buildRubricGuideBlock,
  buildRubricSchemaBlock,
  normalizeRubricScoring,
  stripNonErrors,
  type GrammarErrorSummaryItem,
  type SpellingErrorSummaryItem,
  type WritingCategoryScores,
  type WritingError,
  type WritingEssayAnalysis,
  type WritingOverallEvaluation,
  type WritingRubricItem,
  type WritingTaskFormat,
} from '@/lib/ai/writing-grading'

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

type WritingDetailedScore = {
  score: number
  level: number
  cefr: string
  detail: string
  gapFromTest: {
    testLevel: number | null
    writingLevel: number
    gap: number | null
    gapAnalysis: string
  } | null
}

type WritingCorrection = {
  original: string
  corrected: string
  explanation: string
  relatedStrength: string
  levelImpact: string
}

type WritingStrategy = {
  priority: number
  title: string
  bridgingFrom: string
  problem: string
  action: string
  dailyDrill?: string
  template?: string
  upgradeChecklist?: string[]
  example?: { before: string; after: string }
  weeklyGoal: string
  expectedLevelGain: string
}

export interface WritingEvaluationResult {
  writingLevelAssessment: {
    assessedLevel: number
    assessedCefr: string
    assessedLevelName: string
    confidence: string
    summary: string
  }
  detailedScores: {
    grammarInWriting: WritingDetailedScore
    organization: WritingDetailedScore
    vocabularyInWriting: WritingDetailedScore
    expression: WritingDetailedScore
    totalScore: number
    totalLevel: number
    totalCefr: string
  }
  crossDomainAnalysis: {
    levelMap: {
      grammar: { testLevel: number | null; writingLevel: number; gap: number | null; emoji: string }
      vocabulary: { testLevel: number | null; writingLevel: number; gap: number | null; emoji: string }
      reading: { testLevel: number | null; writingLevel: number; gap: number | null; emoji: string }
      expression: { testLevel: number | null; writingLevel: number; gap: number | null; emoji: string }
    }
    biggestGap: {
      area: string
      detail: string
      impact: string
    }
    overallDiagnosis: string
  }
  corrections: WritingCorrection[]
  levelUpStrategy: {
    currentWritingLevel: number
    currentWritingCefr: string
    targetWritingLevel: number
    targetWritingCefr: string
    targetReason: string
    estimatedWeeks: number
    keyMessage: string
    strategies: WritingStrategy[]
    weeklyPlan: {
      week1_2: string
      week3_4: string
      week5_6: string
    }
    milestones: {
      week: number
      target: string
      sign: string
    }[]
    encouragement: string
  }
  modelEssay: {
    targetLevel: number
    targetLevelName: string
    text: string
    wordCount: number
    levelFeatures: string[]
  }
  // 평가항목별 배점 채점 + 종합 총평 (교사 채점 리포트와 공통 스키마)
  detectedTaskFormat: WritingTaskFormat
  rubricItems: WritingRubricItem[]
  overallEvaluation: WritingOverallEvaluation
  essayAnalysis: WritingEssayAnalysis | null
  // 문법/철자/어휘/문장구조/응집성/과제수행도 6영역 상세 오류분석 (교사 채점 리포트와 공통 스키마)
  categoryScores: WritingCategoryScores
  strengths: string[]
  errors: WritingError[]
  spellingErrorSummary: SpellingErrorSummaryItem[]
  grammarErrorSummary: GrammarErrorSummaryItem[]
  improvedVersion: string
  nextStepRecommendation: string
}

type StudentProfileInput = {
  currentLevel: number
  cefrLevel: string
  grammarAvg: number | null
  vocabAvg: number | null
  readingAvg: number | null
  writingAvg: number | null
  recentWritingScores: number[]
  domainLevels: DomainLevels | null
}

type RequestBody = {
  essay: string
  topicTitle: string
  topicPrompt: string
  minWords: number
  maxWords: number
  studentProfile: StudentProfileInput
}

// ── 시스템 프롬프트 ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `너는 20년 경력의 영어 교육 평가 전문가야. 한국 영어학원 학생의 에세이를 평가해.

핵심 원칙:
1. 학생의 현재 레벨을 기준으로 평가하지 마. 에세이 자체의 실력을 독립적으로 판정해.
2. 10단계 레벨 체계(Level 1~10)를 사용해.
3. 학생의 문법/어휘/읽기 레벨과 쓰기 레벨의 격차를 분석해.
4. 격차를 줄이는 구체적 전략을 제시해.
5. 반드시 JSON으로만 응답해. 한국어로 작성해.

## 오류 상세 분석 원칙 (errors, categoryScores 등)
6. 문법(Grammar), 철자(Spelling), 어휘(Vocabulary), 문장 구조(Sentence Structure), 과제 수행도(Task Achievement), 응집성(Coherence) 6개 영역을 categoryScores로 각각 0~100점 채점해.
7. 모든 오류는 원문에서 정확한 위치(원본 텍스트 그대로)를 인용하고, 수정안과 "왜 틀렸는지"에 대한 한국어 설명을 함께 제공해. 설명은 학생 레벨에 맞는 문법 용어 난이도를 사용해.
8. 오류를 지적할 때 비난조가 아닌 격려하는 톤을 유지해. 잘 쓴 표현이나 시도는 반드시 최소 1개 이상 구체적으로 칭찬해 (strengths).
9. 철자 오류(spelling: 단어 표기 자체가 틀림)와 문법 오류(grammar: 시제/수일치/관사/전치사/어순 등)를 명확히 구분해.
10. 같은 오류가 반복되면 처음 1회만 상세 설명하고, 이후 반복은 occurrenceCount로 묶어서 표시해.
10-1. errors 배열에는 실제로 틀린 부분만 넣어. original과 corrected가 같은 문장이거나 "오류가 발견되지 않았습니다"처럼 오류가 아니라고 설명하는 항목은 절대 넣지 마. 실제 오류가 전혀 없으면 errors는 빈 배열([])로 반환해. 오류 개수를 채우려고 없는 오류를 만들어내지 마.
11. 원어민 관점의 자연스러움과 학습자 영어의 허용 범위를 구분해. 문법적으로 틀리지 않았지만 어색한 표현은 "minor" 심각도의 vocabulary 오류로 분류하고 실제 문법 규칙 위반과 섞지 마.
12. 절대 원문에 없는 문장을 임의로 추가하여 오류로 지적하지 마.
13. 오류는 4단계 구조로 설명해: ① 틀린 표현(original) ② 맞는 표현(corrected) ③ 왜 틀렸는지(whyItsWrong) ④ 암기 팁(howToRemember). 여기에 detailedExplanationKo와 similarCorrectExamples(올바른 예문 2개)를 추가해.

## taskFormat 판별 및 평가항목 채점 원칙 (필수)
14. 문제의 성격과 목표 단어 수로 taskFormat을 판별해 detectedTaskFormat에 기록해.
    - "sentence_practice": 문장/짧은 단락 쓰기 연습 (목표 단어 수 150워드 이하, 일기/묘사/짧은 답변형)
    - "academic_essay": 논술/에세이형 과제 (목표 단어 수 150워드 이상, 찬반/장단점/비교 등 구조화된 논증)
15. 문법이 완벽해도 논리/구성이 없으면 낮게, 문법이 다소 부족해도 논리가 탄탄하면 상대적으로 높게 평가해. 과제 수행/구성/내용 전개가 문법보다 채점 우선순위가 높아(배점에도 반영되어 있음).
16. 판별한 taskFormat의 평가항목표를 그대로 사용해. 항목 추가/삭제 금지.
17. 각 항목은 그 자체로 0~100점 만점으로 독립 채점해(score). weight가 작은 항목이라고 낮은 만점 기준으로 채점하지 마 — weight는 전체 총점에서 차지하는 비중(%)일 뿐 항목 자체의 만점이 아니야. weight 값은 평가항목표에 정의된 값을 그대로 사용하고 바꾸지 마. comment(한국어 2~3문장)에는 (가) 왜 그 점수(100점 만점 기준)인지 원문 근거와 (나) 100점에 가까워지는 방법을 담아.
18. overallEvaluation.totalPoints(0~100)는 모든 rubricItems의 (score × weight ÷ 100)을 더한 가중평균이야. rubricItems를 다 채운 뒤 반드시 각 항목의 (score × weight ÷ 100)을 계산해 손으로 더하고, 반올림한 값을 totalPoints에 넣어. grade는 A(90~100)/B(80~89)/C(70~79)/D(60~69)/F(0~59)로 부여해.
19. summaryKo(종합 총평 3~5문장)는 항목별 점수와 모순되지 않게 작성해. detailedScores.totalScore와 categoryScores도 항목 점수와 일관되게 맞춰.
20. detectedTaskFormat이 academic_essay이면 essayAnalysis는 생략할 수 없는 필수 필드야. questionAnalysis/taskCoverage/structureMap/peelAnalysis/sentenceVariety/cohesiveDevices/revisionChecklist/improvedParagraphSample을 모두 채워(인용은 짧게). sentence_practice일 때만 null로 둬.
21. taskCoverage 중 하나라도 covered:false이면 taskAchievement(과제 수행) 항목의 score는 반드시 60점 이하로 채점해. 반대로 요구사항을 모두 충족했다고 판정했으면 과제 수행 점수를 근거 없이 낮게 주지 마.`

// ── 프롬프트 빌더 ──────────────────────────────────────────────────────────────

function buildUserPrompt(body: RequestBody, wordCount: number): string {
  const { essay, topicTitle, topicPrompt, minWords, maxWords, studentProfile } = body
  const { domainLevels, recentWritingScores } = studentProfile

  const g = domainLevels?.grammar
  const v = domainLevels?.vocabulary
  const r = domainLevels?.reading
  const w = domainLevels?.writing
  const gaps = domainLevels?.gaps

  const recentStr =
    recentWritingScores.length > 0 ? recentWritingScores.join(', ') + '점' : '이전 기록 없음'

  const l = domainLevels?.listening
  const domainSection = domainLevels
    ? `## 학생 ${l ? '5' : '4'}영역 현재 실력 (참고용, 쓰기 평가의 기준으로 사용하지 마)
- 문법: ${g!.score}점 / Level ${g!.level} (${g!.cefr})
- 어휘: ${v!.score}점 / Level ${v!.level} (${v!.cefr})
- 읽기: ${r!.score}점 / Level ${r!.level} (${r!.cefr})${l ? `\n- 듣기: ${l.score}점 / Level ${l.level} (${l.cefr})` : ''}
- 쓰기 최근 평균: ${w!.score}점 / Level ${w!.level} (${w!.cefr})
- 최대 격차: ${gaps!.strongest.domain} Level ${gaps!.strongest.level} vs ${gaps!.weakest.domain} Level ${gaps!.weakest.level} (${gaps!.maxGap}단계 차이)`
    : `## 학생 영역별 현재 실력
- 아직 충분한 평가 데이터가 없습니다. 에세이 자체 실력만으로 판정해주세요.`

  const targetLevel = Math.min((domainLevels?.writing.level ?? 1) + 2, 10)
  const targetCefr = [
    'Pre-A1', 'A1 하', 'A1 상', 'A2 하', 'A2 상',
    'B1 하', 'B1 상', 'B2 하', 'B2 상', 'C1+',
  ][targetLevel - 1]

  return `아래 학생의 영어 에세이를 평가해줘.

## 10단계 레벨 기준
- Level 1 (Pre-A1): 알파벳/단어 수준, 문장 구성 불가
- Level 2 (A1 하): be동사, 현재시제, 단어 나열
- Level 3 (A1 상): 기초 문장 구성, I am/I like 수준
- Level 4 (A2 하): 과거시제 시도, 전치사, 2~3문장 연결
- Level 5 (A2 상): and/but/because 연결, 짧은 단락, 일상 주제
- Level 6 (B1 하): 연결어(however, also), 의견 표현, 서론-본론-결론 시도
- Level 7 (B1 상): 관계대명사, 완료시제, 논리적 단락, 이유+예시
- Level 8 (B2 하): 복문/가정법, 추상적 주제, 다양한 어휘, 비교/대조
- Level 9 (B2 상): 정교한 문장, 학술 어휘, 비판적 사고, 수사적 기법
- Level 10 (C1+): 네이티브급, 뉘앙스 구분, 학술적 글쓰기

${domainSection}

## 이전 쓰기 평가 이력
- 최근 5회 점수: ${recentStr}

## 에세이
- 주제: ${topicTitle}
- 영어 프롬프트: ${topicPrompt}
- 권장 단어 수: ${minWords}~${maxWords}단어
- 실제 단어 수: ${wordCount}단어

## 에세이 원문
${essay}

## 평가항목표 (판별한 taskFormat의 표를 그대로 사용, 배점 변경 금지)
${buildRubricGuideBlock()}

## 응답 (JSON, 한국어)
{
  ${buildRubricSchemaBlock()},

  "writingLevelAssessment": {
    "assessedLevel": 에세이를 독립적으로 평가한 Level (1~10 정수),
    "assessedCefr": "해당 레벨의 CEFR (예: A2 하)",
    "assessedLevelName": "해당 레벨 이름 (예: 초급 하)",
    "confidence": "high 또는 medium 또는 low",
    "summary": "이 에세이가 왜 해당 레벨인지 설명 + 다음 레벨로 가려면 무엇이 필요한지 (2~3문장)"
  },

  "detailedScores": {
    "grammarInWriting": {
      "score": 0~100 정수,
      "level": 1~10 정수,
      "cefr": "해당 레벨 CEFR",
      "detail": "이 에세이의 문법 활용 구체적 설명 (1~2문장). 시험 레벨과 쓰기에서 실제 활용하는 레벨의 차이 언급",
      "gapFromTest": ${domainLevels ? `{
        "testLevel": ${g!.level},
        "writingLevel": 이 에세이의 문법 레벨 (1~10),
        "gap": 차이 (testLevel - writingLevel),
        "gapAnalysis": "시험 레벨과 쓰기 레벨 차이에 대한 설명"
      }` : 'null'}
    },
    "organization": {
      "score": 0~100 정수,
      "level": 1~10 정수,
      "cefr": "해당 레벨 CEFR",
      "detail": "글 구성력 구체적 설명 (1~2문장). 읽기 레벨과의 비교 언급",
      "gapFromTest": ${domainLevels ? `{
        "testLevel": ${r!.level},
        "writingLevel": 이 에세이의 구성 레벨 (1~10),
        "gap": 차이 (testLevel - writingLevel),
        "gapAnalysis": "읽기 레벨과 구성력 레벨 차이에 대한 설명"
      }` : 'null'}
    },
    "vocabularyInWriting": {
      "score": 0~100 정수,
      "level": 1~10 정수,
      "cefr": "해당 레벨 CEFR",
      "detail": "어휘 활용 구체적 설명 (1~2문장). 시험 어휘 레벨과 비교",
      "gapFromTest": ${domainLevels ? `{
        "testLevel": ${v!.level},
        "writingLevel": 이 에세이의 어휘 레벨 (1~10),
        "gap": 차이 (testLevel - writingLevel),
        "gapAnalysis": "어휘 시험 레벨과 쓰기 어휘 레벨 차이 설명"
      }` : 'null'}
    },
    "expression": {
      "score": 0~100 정수,
      "level": 1~10 정수,
      "cefr": "해당 레벨 CEFR",
      "detail": "표현력 구체적 설명 (1~2문장)",
      "gapFromTest": null
    },
    "totalScore": 4개 점수의 평균 (정수),
    "totalLevel": 종합 레벨 (1~10),
    "totalCefr": "종합 CEFR"
  },

  "crossDomainAnalysis": {
    "levelMap": {
      "grammar": { "testLevel": ${g?.level ?? null}, "writingLevel": grammarInWriting.level, "gap": 차이, "emoji": "⚠️ 또는 🔴 또는 ✅" },
      "vocabulary": { "testLevel": ${v?.level ?? null}, "writingLevel": vocabularyInWriting.level, "gap": 차이, "emoji": "⚠️ 또는 🔴 또는 ✅" },
      "reading": { "testLevel": ${r?.level ?? null}, "writingLevel": organization.level, "gap": 차이, "emoji": "⚠️ 또는 🔴 또는 ✅" },
      "expression": { "testLevel": null, "writingLevel": expression.level, "gap": null, "emoji": "" }
    },
    "biggestGap": {
      "area": "가장 큰 격차가 있는 영역 설명",
      "detail": "구체적인 격차 내용",
      "impact": "쓰기 점수에 미치는 영향"
    },
    "overallDiagnosis": "영역별 레벨과 쓰기 레벨을 종합적으로 분석한 진단 (2~3문장, 학생에게 직접 말하는 톤)"
  },

  "corrections": [
    {
      "original": "원문의 오류 있는 문장 또는 구",
      "corrected": "교정된 문장",
      "explanation": "왜 틀렸고 어떻게 고쳐야 하는지 한국어로",
      "relatedStrength": "학생의 어떤 강점(시험 점수)과 연결되는지",
      "levelImpact": "이 수정이 레벨에 미치는 영향 (예: Level 4 → 5~6으로 상승 가능)"
    }
  ],

  "levelUpStrategy": {
    "currentWritingLevel": writingLevelAssessment.assessedLevel,
    "currentWritingCefr": writingLevelAssessment.assessedCefr,
    "targetWritingLevel": ${targetLevel},
    "targetWritingCefr": "${targetCefr}",
    "targetReason": "왜 이 레벨을 목표로 설정했는지",
    "estimatedWeeks": 현실적인 예상 주수 (4~12),
    "keyMessage": "학생에게 핵심 메시지 (다른 영역의 강점을 활용하는 방향으로)",
    "strategies": [
      {
        "priority": 1,
        "title": "전략 제목",
        "bridgingFrom": "강한 영역 → 약한 쓰기 영역 (예: 어휘 Lv7 → 쓰기 어휘 Lv4)",
        "problem": "현재 문제점",
        "action": "구체적 실천 방법",
        "weeklyGoal": "이번 주 목표",
        "expectedLevelGain": "예상 레벨 향상"
      },
      { "priority": 2, ... },
      { "priority": 3, ... }
    ],
    "weeklyPlan": {
      "week1_2": "1~2주차 계획",
      "week3_4": "3~4주차 계획",
      "week5_6": "5~6주차 계획"
    },
    "milestones": [
      { "week": 2, "target": "Level X (CEFR) 도달", "sign": "달성 기준 표시" },
      { "week": 4, "target": "Level X~Y 경계", "sign": "달성 기준 표시" },
      { "week": 6, "target": "Level Y 도달", "sign": "달성 기준 표시" }
    ],
    "encouragement": "학생의 강점을 언급하며 동기를 부여하는 격려 메시지"
  },

  "modelEssay": {
    "targetLevel": ${targetLevel},
    "targetLevelName": "Level ${targetLevel} (${targetCefr}) 모범 답안",
    "text": "같은 주제로 Level ${targetLevel}에 맞는 모범 답안 (영어, ${minWords}~${maxWords}단어 기준으로 약간 더 길어도 됨)",
    "wordCount": 모범 답안 단어 수,
    "levelFeatures": ["Level ${targetLevel} 특징 1", "특징 2", "특징 3", "특징 4", "특징 5"]
  },

  "categoryScores": {
    "grammar": 0-100, "spelling": 0-100, "vocabulary": 0-100,
    "sentenceStructure": 0-100, "coherence": 0-100, "taskAchievement": 0-100
  },
  "strengths": ["학생이 잘한 점 구체적 서술 (한국어, 1~3개)"],
  "errors": [
    {
      "type": "grammar | spelling | vocabulary | punctuation | sentenceStructure",
      "subType": "예: 시제, 수일치, 관사, 전치사, 철자, 어순, collocation 등",
      "original": "틀린 표현 (원문 그대로 인용)",
      "corrected": "맞는 표현",
      "explanationKo": "한 줄 요약 설명",
      "whyItsWrong": "왜 틀렸는지 (규칙 중심 설명)",
      "howToRemember": "암기 팁",
      "detailedExplanationKo": "문단 형태의 상세 설명 (2~3문장)",
      "similarCorrectExamples": ["올바른 예문 1", "올바른 예문 2"],
      "severity": "minor | moderate | major",
      "occurrenceCount": 동일 오류가 반복된 횟수 (기본 1),
      "otherOccurrences": ["같은 유형이 반복된 다른 위치 인용 (없으면 빈 배열)"]
    }
  ],
  "spellingErrorSummary": [
    { "misspelled": "틀린 단어", "correct": "올바른 철자", "occurrenceCount": 횟수 }
  ],
  "grammarErrorSummary": [
    { "category": "시제 | 수일치 | 관사 | 전치사 | 어순 | 기타", "count": 개수, "examples": ["대표 예시 1~2개"] }
  ],
  "improvedVersion": "학생 원문의 의도와 어휘 수준은 최대한 유지하되, 지적한 오류만 수정한 전체 버전 (Before/After 비교용)",
  "nextStepRecommendation": "학생에게 줄 다음 학습 추천 (예: 관사 집중 연습, 특정 word set 복습 등)",

  ${buildEssayAnalysisSchema()}
}

주의사항:
- corrections는 실제 오류가 있는 경우만 포함 (최대 5개). 오류가 없으면 빈 배열 [].
- errors는 corrections보다 세밀한 오류 목록으로, 발견된 모든 오류를 포함 (반복 오류는 occurrenceCount로 묶음).
- Level 1~3는 corrections/errors를 적게 제시하고 칭찬 위주로.
- modelEssay.text는 반드시 영어로 작성 (해설은 levelFeatures에 한국어로).
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

    // ── 사용량 한도 체크 ──────────────────────────────────────────────────────
    const dbUserForUsage = await prisma.user.findUnique({
      where: { id: user.id, isDeleted: false },
      select: { academyId: true },
    })
    const academyId = dbUserForUsage?.academyId
    if (academyId) {
      const usageCheck = await checkAiUsageLimit(academyId, 'WRITING')
      if (!usageCheck.canUse) {
        return NextResponse.json(
          { error: 'limit_exceeded', message: usageCheck.message, upgrade: true },
          { status: 402 },
        )
      }
    }

    const wordCount = body.essay.trim().split(/\s+/).filter(Boolean).length

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(body, wordCount) },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0].message.content
    if (!rawContent) {
      return NextResponse.json({ error: 'AI 응답을 받지 못했습니다.' }, { status: 500 })
    }

    // AI가 배점 합계/오류 없음 표시 등 프롬프트 지시를 어길 수 있으므로 서버에서 재검증한다.
    const parsedResult = JSON.parse(rawContent) as WritingEvaluationResult
    const result: WritingEvaluationResult = {
      ...normalizeRubricScoring(parsedResult),
      errors: stripNonErrors(parsedResult.errors ?? []),
    }

    // ── 사용량 기록 + 초과 결제 큐 ────────────────────────────────────────────
    if (academyId) {
      const usageCheck = await checkAiUsageLimit(academyId, 'WRITING')
      await trackAiUsage(academyId, 'WRITING')
      if (usageCheck.source === 'OVERAGE') {
        queueOverageCharge(academyId, 'WRITING', 1)
      }
    }

    // ── DB 저장 ────────────────────────────────────────────────────────────────
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id, isDeleted: false },
        select: { student: { select: { id: true, currentLevel: true } } },
      })

      if (dbUser?.student) {
        const { id: studentId, currentLevel } = dbUser.student
        const assessedLevel = result.writingLevelAssessment.assessedLevel
        const writingScore = result.detailedScores.totalScore

        await prisma.$transaction([
          // 1) skill_assessments에 WRITING 점수 저장 (assessedLevel 기준)
          prisma.skillAssessment.create({
            data: {
              studentId,
              domain: 'WRITING',
              level: assessedLevel,
              score: writingScore,
              notes: `AI 쓰기 연습 - ${body.topicTitle}`,
            },
          }),
          // 2) reports에 전체 평가 결과 저장
          prisma.report.create({
            data: {
              studentId,
              type: 'WRITING_PRACTICE',
              dataJson: {
                topicTitle: body.topicTitle,
                topicPrompt: body.topicPrompt,
                essay: body.essay,
                wordCount,
                level: currentLevel,
                assessedLevel,
                domainLevels: body.studentProfile.domainLevels,
                writingLevelAssessment: result.writingLevelAssessment,
                detailedScores: result.detailedScores,
                crossDomainAnalysis: result.crossDomainAnalysis,
                corrections: result.corrections,
                levelUpStrategy: result.levelUpStrategy,
                modelEssay: result.modelEssay,
                detectedTaskFormat: result.detectedTaskFormat,
                rubricItems: result.rubricItems,
                overallEvaluation: result.overallEvaluation,
                essayAnalysis: result.essayAnalysis,
                categoryScores: result.categoryScores,
                strengths: result.strengths,
                errors: result.errors,
                spellingErrorSummary: result.spellingErrorSummary,
                grammarErrorSummary: result.grammarErrorSummary,
                improvedVersion: result.improvedVersion,
                nextStepRecommendation: result.nextStepRecommendation,
                // 이전 형식 호환용
                percentage: writingScore,
              },
            },
          }),
        ])
      }
    } catch (dbError) {
      console.error('[evaluate-writing] DB 저장 오류:', dbError)
    }

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
