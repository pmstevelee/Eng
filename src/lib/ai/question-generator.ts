import OpenAI from 'openai'
import { prisma } from '@/lib/prisma/client'
import type { StudentProfile } from './student-analyzer'

// ── 타입 ───────────────────────────────────────────────────────────────────────

export type SourceQuestion = {
  id: string
  domain: string
  subCategory: string | null
  difficulty: number
  cefrLevel: string | null
  contentJson: {
    type: string
    question_text: string
    question_text_ko?: string
    options?: string[]
    correct_answer?: string
    passage?: string
    explanation?: string
  }
}

export type GeneratedQuestion = {
  id: string
  domain: string
  subCategory: string | null
  difficulty: number
  cefrLevel: string | null
  contentJson: {
    type: string
    question_text: string
    options?: string[]
    correct_answer?: string
    passage?: string
    explanation?: string
    explanation_tip?: string
  }
}

interface AiQuestionRaw {
  subCategory?: string
  question_text?: string
  options?: string[]
  correct_answer?: string
  passage?: string
  explanation?: string
  explanation_tip?: string
  explanationTip?: string
}

// ── 상수 ───────────────────────────────────────────────────────────────────────

const DOMAIN_NAMES: Record<string, string> = {
  GRAMMAR: '문법(Grammar)',
  VOCABULARY: '어휘(Vocabulary)',
  READING: '읽기(Reading)',
  WRITING: '쓰기(Writing)',
}

const LEVEL_GUIDANCE: Record<number, string> = {
  1: '짧고 단순한 문장, 일상생활 주제, 기초 어휘',
  2: '단순한 문장, 일상생활·학교 주제, 기초~중급 어휘',
  3: '중급 문법, 학교·취미·사회 주제, 중급 어휘',
  4: '복잡한 문장 구조, 학술·사회 주제, 고급 어휘',
  5: '고급 문법·어휘, 추상적·학술적 주제, 복잡한 논증',
}

// ── 메인 함수 ──────────────────────────────────────────────────────────────────

/**
 * 원본 문제와 유사하지만 다른 문제를 AI로 생성하고 DB에 저장합니다.
 * 학습 흐름을 끊지 않도록 생성된 문제를 즉시 반환합니다.
 */
export async function generateSimilarQuestions(
  originalQuestion: SourceQuestion,
  profile: StudentProfile,
  count: number,
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[question-generator] OPENAI_API_KEY가 설정되지 않았습니다.')
    return []
  }

  const openai = new OpenAI({ apiKey })

  const domain = originalQuestion.domain
  const isReading = domain === 'READING'

  const domainScore =
    profile.domainScores[domain.toLowerCase() as keyof typeof profile.domainScores]
  const domainAvg = domainScore?.avg ?? '미측정'
  const weakCategories = domainScore?.weakCategories.slice(0, 3).join(', ') || '없음'
  const trend =
    domainScore?.trend === 'improving'
      ? '상승 중'
      : domainScore?.trend === 'declining'
      ? '하락 중'
      : '정체'

  const levelGuidance = LEVEL_GUIDANCE[profile.currentLevel] ?? LEVEL_GUIDANCE[3]

  // ── 시스템 프롬프트 ────────────────────────────────────────────────────────

  const systemPrompt = `너는 영어 교육 전문가야. 한국 영어학원의 학생을 위한 영어 문제를 만들어.
학생의 현재 레벨과 약점에 맞춰 유사하지만 다른 문제를 생성해야 해.
반드시 JSON 형식으로만 응답해. 다른 텍스트는 포함하지 마.

반환 형식:
{
  "questions": [
    {
      "subCategory": "세부 카테고리",
      "question_text": "문제 본문 (영어)",
      ${isReading ? '"passage": "지문 (영어, 원본과 유사한 길이)",' : ''}
      "options": ["선택지A", "선택지B", "선택지C", "선택지D"],
      "correct_answer": "A",
      "explanation": "해설 (한국어, 왜 이 답이 맞는지 + 학생의 약점 포인트 설명)",
      "explanation_tip": "이 유형의 문제를 잘 풀려면: (학습 팁 1문장, 한국어)"
    }
  ]
}`

  // ── 유저 프롬프트 ──────────────────────────────────────────────────────────

  const userPrompt = `아래 원본 문제와 유사하지만 다른 문제를 ${count}개 만들어줘.

## 학생 정보
- 현재 레벨: Level ${profile.currentLevel} (CEFR ${profile.cefrLevel})
- 레벨 특성: ${levelGuidance}
- ${DOMAIN_NAMES[domain] ?? domain} 평균 점수: ${domainAvg}점
- 약점 카테고리: ${weakCategories}
- 최근 정답률 추이: ${trend}

## 원본 문제
- 영역: ${DOMAIN_NAMES[domain] ?? domain}
- 카테고리: ${originalQuestion.subCategory ?? '없음'}
- 난이도: ${originalQuestion.difficulty}/5
- CEFR: ${originalQuestion.cefrLevel ?? profile.cefrLevel}
- 문제: ${originalQuestion.contentJson.question_text}
${isReading && originalQuestion.contentJson.passage ? `- 지문: ${originalQuestion.contentJson.passage}` : ''}
${originalQuestion.contentJson.options?.length ? `- 선택지: ${originalQuestion.contentJson.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}` : ''}
- 정답: ${originalQuestion.contentJson.correct_answer ?? '없음'}

## 생성 규칙
1. 같은 문법/어휘 포인트를 테스트하되 다른 문장/상황 사용
2. 난이도는 원본과 같거나 학생 수준에 맞게 약간 조절
3. 학생의 CEFR 레벨에 맞는 어휘와 문장 구조 사용
4. 객관식이면 오답 선택지도 학생이 실수할 만한 것으로 구성
5. 한국 학생이 자주 틀리는 포인트 반영
6. explanation은 학생의 약점 카테고리(${weakCategories})와 연결해서 설명`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.75,
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0].message.content
    if (!rawContent) return []

    const parsed = JSON.parse(rawContent) as { questions: AiQuestionRaw[] }
    const aiQuestions = parsed.questions ?? []

    if (aiQuestions.length === 0) return []

    // ── DB 저장 (백그라운드, 실패해도 계속) ─────────────────────────────────

    const savedQuestions: GeneratedQuestion[] = []

    for (const q of aiQuestions) {
      if (!q.question_text) continue

      const contentJson = {
        type: originalQuestion.contentJson.type,
        question_text: q.question_text,
        ...(isReading && q.passage ? { passage: q.passage } : {}),
        ...(q.options && q.options.length > 0 ? { options: q.options } : {}),
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        explanation_tip: q.explanation_tip ?? q.explanationTip,
      }

      try {
        const saved = await prisma.question.create({
          data: {
            domain: originalQuestion.domain as
              | 'GRAMMAR'
              | 'VOCABULARY'
              | 'READING'
              | 'WRITING'
              | 'LISTENING',
            subCategory: q.subCategory ?? originalQuestion.subCategory,
            difficulty: originalQuestion.difficulty,
            cefrLevel: originalQuestion.cefrLevel ?? profile.cefrLevel,
            contentJson,
            statsJson: {
              aiGenerated: true,
              sourceQuestionId: originalQuestion.id,
            },
            // academyId: null → 공용 문제
          },
        })

        savedQuestions.push({
          id: saved.id,
          domain: saved.domain,
          subCategory: saved.subCategory,
          difficulty: saved.difficulty,
          cefrLevel: saved.cefrLevel,
          contentJson: contentJson as GeneratedQuestion['contentJson'],
        })
      } catch (saveErr) {
        console.error('[question-generator] DB 저장 실패:', saveErr)
        // 저장 실패해도 인메모리 데이터로 반환
        savedQuestions.push({
          id: `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          domain: originalQuestion.domain,
          subCategory: q.subCategory ?? originalQuestion.subCategory,
          difficulty: originalQuestion.difficulty,
          cefrLevel: originalQuestion.cefrLevel ?? profile.cefrLevel,
          contentJson: contentJson as GeneratedQuestion['contentJson'],
        })
      }
    }

    return savedQuestions
  } catch (err) {
    console.error('[question-generator] OpenAI 호출 실패:', err)
    return []
  }
}
