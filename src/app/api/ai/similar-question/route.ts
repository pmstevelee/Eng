import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

interface SimilarQuestionRequest {
  questionText: string
  studentAnswer: string
  correctAnswer: string
  level: number
  cefr: string
  categoryAccuracy: number
  difficulty: 'easier' | 'same' | 'harder'
  domain: string
}

interface SimilarQuestionResponse {
  questionText: string
  options: string[]
  correctAnswer: string
  explanation: string
  keyPoint: string
  commonMistake: string
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = (await req.json()) as SimilarQuestionRequest
    const { questionText, studentAnswer, correctAnswer, level, cefr, categoryAccuracy, difficulty } =
      body

    if (!questionText || !correctAnswer || !level || !cefr) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    const userPrompt = `학생이 아래 문제를 틀렸어. 같은 포인트를 테스트하되 ${
      difficulty === 'easier' ? '더 쉬운' : difficulty === 'harder' ? '더 어려운' : '비슷한 수준의'
    } 버전을 만들어줘.

학생 레벨: Level ${level} (CEFR ${cefr})
틀린 문제: ${questionText}
학생의 답: ${studentAnswer}
정답: ${correctAnswer}
이 카테고리 정답률: ${categoryAccuracy}%

난이도 조절: ${difficulty}
- easier: 더 짧은 문장, 더 명확한 단서, 일상적인 어휘
- same: 비슷한 수준
- harder: 더 긴 문장, 간접적인 단서, 학술적 어휘

응답 (JSON만):
{
  "questionText": "유사 문제 (영어)",
  "options": ["A번 선택지", "B번 선택지", "C번 선택지", "D번 선택지"],
  "correctAnswer": "A",
  "explanation": "해설 (한국어). 학생이 '${studentAnswer}'를 선택한 이유를 추측하고, 왜 틀렸는지 구체적으로 설명",
  "keyPoint": "이 유형의 핵심 포인트 1문장 (한국어)",
  "commonMistake": "한국 학생들이 이 유형에서 자주 하는 실수 (한국어)"
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '너는 영어 교육 전문가야. 학생이 방금 틀린 문제와 같은 문법/어휘 포인트를 테스트하는 유사 문제를 만들어. 반드시 JSON만 응답해.',
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0]?.message?.content
    if (!rawContent) {
      return NextResponse.json({ error: 'AI 응답을 받지 못했습니다.' }, { status: 500 })
    }

    const parsed = JSON.parse(rawContent) as SimilarQuestionResponse

    // Validate response
    if (!parsed.questionText || !Array.isArray(parsed.options) || parsed.options.length < 2) {
      return NextResponse.json({ error: 'AI 응답 형식이 올바르지 않습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (error) {
    console.error('[similar-question] error:', error)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: error.status ?? 500 },
      )
    }
    return NextResponse.json({ error: '유사 문제 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
