import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { type QuestionDomain } from '@/generated/prisma'

interface GenerateQuestionsRequest {
  domain: QuestionDomain
  difficulty: number
  cefrLevel: string
  questionType: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY'
  count: number
  academyId?: string
  saveToBank?: boolean
}

export interface GeneratedQuestion {
  domain: QuestionDomain
  subCategory?: string
  difficulty: number
  cefrLevel: string
  contentJson: {
    type: string
    question: string
    choices?: string[]
    correctAnswer: string
    explanation: string
  }
}

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

    const body = await req.json()
    const {
      domain,
      difficulty,
      cefrLevel,
      questionType,
      count,
      academyId,
      saveToBank = false,
    } = body as GenerateQuestionsRequest

    if (!domain || !difficulty || !cefrLevel || !questionType || !count) {
      return NextResponse.json({ error: '필수 조건이 누락되었습니다.' }, { status: 400 })
    }

    const clampedCount = Math.min(Math.max(count, 1), 20)

    const domainNames: Record<QuestionDomain, string> = {
      GRAMMAR: '문법(Grammar)',
      VOCABULARY: '어휘(Vocabulary)',
      READING: '읽기(Reading)',
      WRITING: '쓰기(Writing)',
      LISTENING: '듣기(Listening)',
    }

    const typeNames: Record<string, string> = {
      MULTIPLE_CHOICE: '4지선다 객관식',
      SHORT_ANSWER: '단답형 주관식',
      ESSAY: '서술형',
    }

    const systemPrompt = `당신은 영어 시험 문제 출제 전문가입니다. 주어진 조건에 맞는 영어 문제를 JSON 형식으로 생성해야 합니다.

반환할 JSON 구조:
{
  "questions": [
    {
      "subCategory": "세부 카테고리 (예: 현재완료, 동의어 등)",
      "question": "문제 내용 (영어)",
      "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],  // 객관식만 포함, 주관식/서술형은 빈 배열
      "correctAnswer": "정답",
      "explanation": "해설 (한국어, 2~3문장)"
    }
  ]
}

- 객관식(MULTIPLE_CHOICE): choices 배열에 4개 선택지 포함
- 주관식(SHORT_ANSWER): choices는 빈 배열, correctAnswer에 정답 단어/문장
- 서술형(ESSAY): choices는 빈 배열, correctAnswer에 모범답안 예시

반드시 유효한 JSON만 반환하세요.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `영역: ${domainNames[domain]}\n난이도: ${difficulty}/10\nCEFR 레벨: ${cefrLevel}\n문제 유형: ${typeNames[questionType]}\n생성 개수: ${clampedCount}개`,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0].message.content
    if (!rawContent) {
      return NextResponse.json({ error: 'AI 응답을 받지 못했습니다.' }, { status: 500 })
    }

    const parsed = JSON.parse(rawContent) as {
      questions: {
        subCategory?: string
        question: string
        choices: string[]
        correctAnswer: string
        explanation: string
      }[]
    }

    const questions: GeneratedQuestion[] = parsed.questions.map((q) => ({
      domain,
      subCategory: q.subCategory,
      difficulty,
      cefrLevel,
      contentJson: {
        type: questionType,
        question: q.question,
        choices: q.choices.length > 0 ? q.choices : undefined,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      },
    }))

    let savedIds: string[] = []
    if (saveToBank && academyId) {
      const created = await prisma.$transaction(
        questions.map((q) =>
          prisma.question.create({
            data: {
              academyId,
              domain: q.domain,
              subCategory: q.subCategory,
              difficulty: q.difficulty,
              cefrLevel: q.cefrLevel,
              contentJson: q.contentJson,
              createdBy: user.id,
            },
          })
        )
      )
      savedIds = created.map((q) => q.id)
    }

    return NextResponse.json({ success: true, data: questions, savedIds })
  } catch (error) {
    console.error('[generate-questions] error:', error)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: error.status ?? 500 }
      )
    }
    return NextResponse.json({ error: 'AI 문제 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
