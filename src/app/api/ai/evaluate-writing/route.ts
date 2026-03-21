import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

export interface WritingEvaluationResult {
  grammar: number
  structure: number
  vocabulary: number
  expression: number
  totalScore: number
  summary: string
  suggestions: [string, string, string]
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
    const { essay, prompt: writingPrompt } = body as { essay: string; prompt?: string }

    if (!essay || essay.trim().length === 0) {
      return NextResponse.json({ error: '에세이 내용이 필요합니다.' }, { status: 400 })
    }

    const systemPrompt = `당신은 영어 교육 전문가입니다. 학생의 영어 에세이를 평가하고 JSON 형식으로 결과를 반환해야 합니다.

평가 기준:
- grammar: 문법 정확성 (1~10점)
- structure: 글의 구성/흐름 (1~10점)
- vocabulary: 어휘 다양성 및 적절성 (1~10점)
- expression: 표현력 및 창의성 (1~10점)
- totalScore: 위 4개 점수의 평균 (소수점 첫째 자리 반올림)
- summary: 전체적인 총평 (2~3문장, 한국어)
- suggestions: 구체적인 개선 제안 3가지 배열 (한국어)

반드시 유효한 JSON만 반환하고 다른 텍스트는 포함하지 마세요.`

    const userContent = writingPrompt
      ? `[작문 주제]\n${writingPrompt}\n\n[학생 에세이]\n${essay}`
      : `[학생 에세이]\n${essay}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
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
        { status: error.status ?? 500 }
      )
    }
    return NextResponse.json({ error: 'AI 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
