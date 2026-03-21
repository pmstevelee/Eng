import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import type { ReportResult } from '@/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json()
    const { studentId } = body as { studentId: string }

    if (!studentId) {
      return NextResponse.json({ error: '학생 ID가 필요합니다.' }, { status: 400 })
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { name: true } } },
    })
    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 최근 1개월 데이터 수집
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const recentSessions = await prisma.testSession.findMany({
      where: {
        studentId,
        completedAt: { gte: oneMonthAgo },
        status: { in: ['COMPLETED', 'GRADED'] },
      },
      include: { test: { select: { title: true, type: true } } },
      orderBy: { completedAt: 'asc' },
    })

    const skillAssessments = await prisma.skillAssessment.findMany({
      where: { studentId, assessedAt: { gte: oneMonthAgo } },
      orderBy: { assessedAt: 'desc' },
    })

    if (recentSessions.length === 0 && skillAssessments.length === 0) {
      return NextResponse.json(
        { error: '최근 1개월 내 학습 데이터가 없습니다.' },
        { status: 400 }
      )
    }

    // 데이터 요약
    const sessionSummary = recentSessions.map((s) => ({
      testTitle: s.test.title,
      testType: s.test.type,
      score: s.score,
      grammarScore: s.grammarScore,
      vocabularyScore: s.vocabularyScore,
      readingScore: s.readingScore,
      writingScore: s.writingScore,
      completedAt: s.completedAt?.toISOString().split('T')[0],
    }))

    const assessmentSummary = skillAssessments.map((a) => ({
      domain: a.domain,
      level: a.level,
      score: a.score,
      date: a.assessedAt.toISOString().split('T')[0],
    }))

    const systemPrompt = `당신은 영어 교육 전문가입니다. 학생의 최근 1개월 학습 데이터를 분석하여 종합 리포트를 JSON 형식으로 작성해야 합니다.

반환할 JSON 구조:
{
  "overallEvaluation": "전체 종합 평가 (3~4문장, 한국어)",
  "domainAnalysis": {
    "grammar": "문법 영역 분석 (1~2문장, 한국어)",
    "vocabulary": "어휘 영역 분석 (1~2문장, 한국어)",
    "reading": "읽기 영역 분석 (1~2문장, 한국어)",
    "writing": "쓰기 영역 분석 (1~2문장, 한국어)"
  },
  "growthPoints": ["성장 포인트 1", "성장 포인트 2", "성장 포인트 3"],
  "studySuggestions": ["학습 제안 1", "학습 제안 2", "학습 제안 3", "학습 제안 4"]
}

모든 내용은 한국어로 작성하세요. 반드시 유효한 JSON만 반환하세요.`

    const dataText = [
      `학생명: ${student.user.name}`,
      `현재 레벨: ${student.currentLevel}`,
      `\n[테스트 세션 (${recentSessions.length}개)]\n${JSON.stringify(sessionSummary, null, 2)}`,
      `\n[영역별 평가 (${skillAssessments.length}개)]\n${JSON.stringify(assessmentSummary, null, 2)}`,
    ].join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: dataText },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0].message.content
    if (!rawContent) {
      return NextResponse.json({ error: 'AI 응답을 받지 못했습니다.' }, { status: 500 })
    }

    const result = JSON.parse(rawContent) as ReportResult

    // reports 테이블에 저장
    const periodEnd = new Date()
    const saved = await prisma.report.create({
      data: {
        studentId,
        generatedBy: user.id,
        type: 'AI_MONTHLY',
        periodStart: oneMonthAgo,
        periodEnd,
        dataJson: {
          ...result,
          metadata: {
            sessionCount: recentSessions.length,
            assessmentCount: skillAssessments.length,
            generatedAt: periodEnd.toISOString(),
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: result, savedId: saved.id })
  } catch (error) {
    console.error('[generate-report] error:', error)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: error.status ?? 500 }
      )
    }
    return NextResponse.json({ error: 'AI 리포트 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
