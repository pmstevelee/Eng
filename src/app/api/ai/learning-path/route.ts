import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

interface DomainScore {
  domain: 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING' | 'WRITING'
  score: number
  history?: number[]
}

export interface LearningPathResult {
  strengths: [string, string]
  weaknesses: [string, string]
  recommendedOrder: string[]
  estimatedLevelUpWeeks: number
  description: string
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
    const { studentId, domainScores } = body as {
      studentId: string
      domainScores: DomainScore[]
    }

    if (!studentId || !domainScores || domainScores.length === 0) {
      return NextResponse.json({ error: '학생 ID와 영역별 점수가 필요합니다.' }, { status: 400 })
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { name: true } } },
    })
    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    const domainNames: Record<string, string> = {
      GRAMMAR: '문법(Grammar)',
      VOCABULARY: '어휘(Vocabulary)',
      READING: '읽기(Reading)',
      LISTENING: '듣기(Listening)',
      WRITING: '쓰기(Writing)',
    }

    const scoresText = domainScores
      .map(
        (d) =>
          `- ${domainNames[d.domain] ?? d.domain}: ${d.score}점${d.history ? ` (최근 이력: ${d.history.join(', ')})` : ''}`
      )
      .join('\n')

    const systemPrompt = `당신은 영어 교육 전문가입니다. 학생의 영역별 점수와 학습 이력을 분석하여 맞춤형 학습 경로를 JSON 형식으로 추천해야 합니다.

반환할 JSON 구조:
{
  "strengths": ["강점 영역 1 (구체적 설명)", "강점 영역 2 (구체적 설명)"],
  "weaknesses": ["약점 영역 1 (구체적 설명)", "약점 영역 2 (구체적 설명)"],
  "recommendedOrder": ["먼저 학습할 영역", "두 번째", "세 번째", "네 번째"],
  "estimatedLevelUpWeeks": 8,
  "description": "전체 학습 경로에 대한 설명 (2~3문장, 한국어)"
}

반드시 유효한 JSON만 반환하세요.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `학생: ${student.user.name}\n현재 레벨: ${student.currentLevel}\n\n영역별 점수:\n${scoresText}`,
        },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0].message.content
    if (!rawContent) {
      return NextResponse.json({ error: 'AI 응답을 받지 못했습니다.' }, { status: 500 })
    }

    const result = JSON.parse(rawContent) as LearningPathResult

    // learning_paths 테이블에 저장
    const saved = await prisma.learningPath.create({
      data: {
        studentId,
        title: `AI 추천 학습 경로 (레벨 ${student.currentLevel})`,
        description: result.description,
        goalsJson: JSON.parse(
          JSON.stringify({
            strengths: result.strengths,
            weaknesses: result.weaknesses,
            recommendedOrder: result.recommendedOrder,
            estimatedLevelUpWeeks: result.estimatedLevelUpWeeks,
            domainScores,
          })
        ),
        isActive: true,
      },
    })

    return NextResponse.json({ success: true, data: result, savedId: saved.id })
  } catch (error) {
    console.error('[learning-path] error:', error)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: error.status ?? 500 }
      )
    }
    return NextResponse.json({ error: 'AI 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
