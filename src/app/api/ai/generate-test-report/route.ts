import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import {
  buildTestResultReportData,
  findSavedTestResultReport,
  REPORT_DOMAIN_LABEL,
  TEST_RESULT_REPORT_TYPE,
  type TestReportNarrative,
  type TestResultReportSnapshot,
} from '@/lib/reports/test-result-report'
import {
  buildTestReportSystemPrompt,
  type NarrativeDomainKey,
} from '@/lib/reports/domain-analysis-prompts'

const TEST_TYPE_KO: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습 테스트',
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

    const body = (await req.json()) as { sessionId?: string; force?: boolean }
    const sessionId = body.sessionId
    if (!sessionId) {
      return NextResponse.json({ error: '세션 ID가 필요합니다.' }, { status: 400 })
    }

    // 권한 확인: 학생 본인 OR 같은 학원의 교사/학원장
    const session = await prisma.testSession.findUnique({
      where: { id: sessionId },
      select: {
        studentId: true,
        student: { select: { user: { select: { academyId: true } } } },
      },
    })
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, academyId: true, student: { select: { id: true } } },
    })
    if (!dbUser) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 403 })
    }
    const isStudent = dbUser.role === 'STUDENT' && dbUser.student?.id === session.studentId
    const isStaff =
      (dbUser.role === 'TEACHER' || dbUser.role === 'ACADEMY_OWNER') &&
      dbUser.academyId === session.student.user.academyId
    if (!isStudent && !isStaff) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    // 저장된 스냅샷이 있으면 그대로 반환 (force 시 재생성)
    if (!body.force) {
      const saved = await findSavedTestResultReport(sessionId)
      if (saved) {
        return NextResponse.json({ success: true, data: saved, cached: true })
      }
    }

    // 통계 집계
    const stats = await buildTestResultReportData(sessionId)
    if (!stats) {
      return NextResponse.json({ error: '결과 데이터를 찾을 수 없습니다.' }, { status: 404 })
    }

    // AI 총평/처방 생성
    const domainLines = stats.domains.map((d) => {
      const label = REPORT_DOMAIN_LABEL[d.domain]
      const subText = d.subCategories
        .map((s) => `${s.subCategory} 정답률 ${s.myRate}%${s.peerRate !== null ? ` (응시자 평균 ${s.peerRate}%)` : ''}`)
        .join(', ')
      return [
        `[${label}] 점수 ${d.score ?? '미채점'}점, Level ${d.level} (${d.cefr}, ${d.levelNameKo})`,
        d.correctRate !== null ? `정답률 ${d.correctRate}% (${d.correctCount}/${d.gradedCount})` : null,
        d.rankPercent !== null ? `동일 테스트 응시자 대비 상위 ${d.rankPercent}%` : null,
        subText ? `평가 항목별: ${subText}` : null,
      ]
        .filter(Boolean)
        .join(' / ')
    })

    const dataText = [
      `학생명: ${stats.student.name}`,
      stats.student.grade ? `학년: ${stats.student.grade}` : null,
      `현재 레벨: Level ${stats.student.currentLevel}`,
      `테스트: ${stats.test.title} (${TEST_TYPE_KO[stats.test.type] ?? stats.test.type}${stats.test.domain ? ` · ${REPORT_DOMAIN_LABEL[stats.test.domain]} 영역 전용` : ''})`,
      `종합 점수: ${stats.totalScore ?? '미채점'}점 → 종합 Level ${stats.overallLevel} (${stats.overallCefr}, ${stats.overallNameKo})`,
      stats.overallRankPercent !== null
        ? `동일 테스트 응시자 ${stats.peerCount}명 중 상위 ${stats.overallRankPercent}%`
        : null,
      '',
      ...domainLines,
    ]
      .filter((l): l is string => l !== null)
      .join('\n')

    const domainKeys = stats.domains.map((d) => d.domain.toLowerCase() as NarrativeDomainKey)

    // 영역별로 다른 평가 기준 적용:
    // 문법/듣기/어휘/독해 = 수능 영어 기준, 쓰기 = 토론토대 학술 영작문 기준
    const systemPrompt = buildTestReportSystemPrompt(domainKeys)

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
    let narrative: TestReportNarrative | null = null
    if (rawContent) {
      try {
        narrative = JSON.parse(rawContent) as TestReportNarrative
      } catch {
        narrative = null
      }
    }

    const snapshot: TestResultReportSnapshot = {
      stats,
      narrative,
      metadata: {
        sessionId,
        testTitle: stats.test.title,
        studentName: stats.student.name,
        generatedAt: new Date().toISOString(),
      },
    }

    await prisma.report.create({
      data: {
        studentId: session.studentId,
        generatedBy: user.id,
        type: TEST_RESULT_REPORT_TYPE,
        periodStart: stats.completedAt ? new Date(stats.completedAt) : new Date(),
        periodEnd: stats.completedAt ? new Date(stats.completedAt) : new Date(),
        dataJson: JSON.parse(JSON.stringify(snapshot)),
      },
    })

    return NextResponse.json({ success: true, data: snapshot })
  } catch (error) {
    console.error('[generate-test-report] error:', error)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: error.status ?? 500 },
      )
    }
    return NextResponse.json({ error: '결과표 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
