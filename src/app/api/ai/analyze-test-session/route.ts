import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

export type TestSessionAnalysis = {
  summary: string
  domainAnalysis: {
    grammar?: string
    vocabulary?: string
    reading?: string
    writing?: string
    listening?: string
  }
  strengths: string[]
  weaknesses: string[]
  wrongPatterns: string
  studyRecommendations: string[]
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
    const { sessionId } = body as { sessionId: string }
    if (!sessionId) {
      return NextResponse.json({ error: '세션 ID가 필요합니다.' }, { status: 400 })
    }

    // 기존 리포트 캐시 확인
    const existing = await prisma.report.findFirst({
      where: {
        type: 'AI_TEST_RESULT',
        dataJson: { path: ['metadata', 'sessionId'], equals: sessionId },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      return NextResponse.json({ success: true, data: existing.dataJson, reportId: existing.id, cached: true })
    }

    // 세션 + 문제 응답 로드
    const session = await prisma.testSession.findUnique({
      where: { id: sessionId },
      include: {
        test: { select: { title: true, type: true, questionOrder: true } },
        student: {
          select: {
            id: true,
            currentLevel: true,
            user: { select: { name: true, academyId: true } },
          },
        },
        questionResponses: {
          select: {
            questionId: true,
            answer: true,
            isCorrect: true,
            answerJson: true,
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 권한 확인: 학생 본인 OR 같은 학원의 교사/학원장
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, academyId: true, student: { select: { id: true } } },
    })
    if (!dbUser) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 403 })
    }

    const studentAcademyId = session.student.user.academyId
    const isStudent = dbUser.role === 'STUDENT' && dbUser.student?.id === session.studentId
    const isStaff =
      (dbUser.role === 'TEACHER' || dbUser.role === 'ACADEMY_OWNER') &&
      dbUser.academyId === studentAcademyId
    if (!isStudent && !isStaff) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    // 문제 정보 로드
    const questionIds = (session.test.questionOrder as string[]) ?? []
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, domain: true, contentJson: true },
    })
    const questionMap = new Map(questions.map((q) => [q.id, q]))
    const responseMap = new Map(session.questionResponses.map((r) => [r.questionId, r]))

    // 영역별 정답/오답 통계
    const domainStats: Record<string, { total: number; correct: number }> = {}
    const wrongQuestions: Array<{ domain: string; questionText: string }> = []

    for (const qId of questionIds) {
      const q = questionMap.get(qId)
      if (!q) continue
      const domain = q.domain
      const resp = responseMap.get(qId)
      if (!domainStats[domain]) domainStats[domain] = { total: 0, correct: 0 }
      domainStats[domain].total++
      if (resp?.isCorrect === true) {
        domainStats[domain].correct++
      } else if (resp?.isCorrect === false) {
        const content = q.contentJson as { question_text?: string }
        wrongQuestions.push({ domain, questionText: content.question_text?.slice(0, 60) ?? '' })
      }
    }

    const DOMAIN_KO: Record<string, string> = {
      GRAMMAR: '문법',
      VOCABULARY: '어휘',
      READING: '독해',
      WRITING: '쓰기',
      LISTENING: '듣기',
    }

    const domainStatsText = Object.entries(domainStats)
      .map(([d, s]) => `${DOMAIN_KO[d] ?? d}: ${s.correct}/${s.total}문제 정답 (${Math.round((s.correct / s.total) * 100)}점)`)
      .join(', ')

    const wrongText = wrongQuestions.slice(0, 5).map((w) => `[${DOMAIN_KO[w.domain] ?? w.domain}] ${w.questionText}`).join('\n')

    const systemPrompt = `당신은 영어 교육 전문가입니다. 학생의 테스트 결과를 분석하여 상세한 리포트를 JSON 형식으로 작성해야 합니다.

반환할 JSON 구조:
{
  "summary": "전체 종합 평가 (3~4문장, 구체적이고 격려적인 한국어)",
  "domainAnalysis": {
    "grammar": "문법 영역 분석 (1~2문장, 데이터 기반)",
    "vocabulary": "어휘 영역 분석 (1~2문장)",
    "reading": "독해 영역 분석 (1~2문장)",
    "writing": "쓰기 영역 분석 (있는 경우만)",
    "listening": "듣기 영역 분석 (있는 경우만)"
  },
  "strengths": ["강점 1", "강점 2", "강점 3"],
  "weaknesses": ["개선 필요 사항 1", "개선 필요 사항 2"],
  "wrongPatterns": "틀린 문제들의 공통 패턴 분석 (2~3문장)",
  "studyRecommendations": ["학습 권고사항 1", "학습 권고사항 2", "학습 권고사항 3", "학습 권고사항 4"]
}

domainAnalysis에는 테스트에 포함된 영역만 포함하세요. 없는 영역은 필드를 생략하세요.
모든 내용은 한국어로 작성하세요. 반드시 유효한 JSON만 반환하세요.`

    const testTypeKo: Record<string, string> = {
      LEVEL_TEST: '레벨 테스트',
      UNIT_TEST: '단원 테스트',
      PRACTICE: '연습 테스트',
    }

    const dataText = [
      `학생명: ${session.student.user.name}`,
      `현재 레벨: ${session.student.currentLevel}`,
      `테스트: ${session.test.title} (${testTypeKo[session.test.type] ?? session.test.type})`,
      `종합 점수: ${session.score ?? '미채점'}점`,
      `영역별 점수: ${[
        session.grammarScore !== null ? `문법 ${session.grammarScore}` : null,
        session.vocabularyScore !== null ? `어휘 ${session.vocabularyScore}` : null,
        session.readingScore !== null ? `독해 ${session.readingScore}` : null,
        session.writingScore !== null ? `쓰기 ${session.writingScore}` : null,
        session.listeningScore !== null ? `듣기 ${session.listeningScore}` : null,
      ].filter(Boolean).join(', ')}`,
      `영역별 정답 통계: ${domainStatsText}`,
      wrongQuestions.length > 0 ? `\n틀린 문제 샘플:\n${wrongText}` : '',
    ]
      .filter(Boolean)
      .join('\n')

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

    const analysis = JSON.parse(rawContent) as TestSessionAnalysis

    const savedReport = await prisma.report.create({
      data: {
        studentId: session.studentId,
        generatedBy: user.id,
        type: 'AI_TEST_RESULT',
        periodStart: session.completedAt ?? new Date(),
        periodEnd: session.completedAt ?? new Date(),
        dataJson: {
          ...analysis,
          metadata: {
            sessionId,
            testTitle: session.test.title,
            testType: session.test.type,
            score: session.score,
            completedAt: session.completedAt?.toISOString(),
            generatedAt: new Date().toISOString(),
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: analysis, reportId: savedReport.id })
  } catch (error) {
    console.error('[analyze-test-session] error:', error)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: error.status ?? 500 },
      )
    }
    return NextResponse.json({ error: 'AI 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
