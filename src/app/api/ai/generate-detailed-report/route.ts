import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import type { DetailedReportResult } from '@/types'

type WritingDataJson = {
  topicTitle?: string
  level?: number
  cefrLevel?: string
  wordCount?: number
  percentage?: number
  totalScore?: number
  totalMaxScore?: number
  scores?: {
    grammar?: { score: number; maxForLevel: number }
    organization?: { score: number; maxForLevel: number }
    vocabulary?: { score: number; maxForLevel: number }
    expression?: { score: number; maxForLevel: number }
  }
}

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

    const body = await req.json()
    const { studentId } = body as { studentId: string }
    if (!studentId) return NextResponse.json({ error: '학생 ID가 필요합니다.' }, { status: 400 })

    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const [student, testSessions, practiceLogs, writingLogs, teacherComments] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        include: {
          user: { select: { name: true, academyId: true } },
          class: { select: { name: true } },
        },
      }),
      prisma.testSession.findMany({
        where: {
          studentId,
          status: { in: ['COMPLETED', 'GRADED'] },
          completedAt: { gte: threeMonthsAgo },
        },
        include: { test: { select: { title: true, type: true } } },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.practiceLog.findMany({
        where: { studentId, createdAt: { gte: threeMonthsAgo } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.report.findMany({
        where: { studentId, type: 'WRITING_PRACTICE', createdAt: { gte: threeMonthsAgo } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      prisma.teacherComment.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { teacher: { select: { name: true } } },
      }),
    ])

    if (!student) return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })

    // 동학년 학생 평균 (같은 학원, 같은 학년)
    let gradeComparison: {
      grade: string | null; peerCount: number
      peerAvgScore: number | null; peerAvgGrammar: number | null
      peerAvgVocabulary: number | null; peerAvgReading: number | null
      peerAvgWriting: number | null
    } | null = null

    if (student.grade && student.user.academyId) {
      const peers = await prisma.student.findMany({
        where: {
          grade: student.grade,
          id: { not: studentId },
          user: { academyId: student.user.academyId, isDeleted: false },
        },
        select: {
          testSessions: {
            where: { status: { in: ['COMPLETED', 'GRADED'] }, completedAt: { gte: threeMonthsAgo } },
            select: { score: true, grammarScore: true, vocabularyScore: true, readingScore: true, writingScore: true },
          },
        },
      })
      const peerScores = peers.flatMap((p) => p.testSessions)
      const nonNull = <T>(v: T | null): v is T => v !== null
      const avg = (arr: (number | null)[]) => {
        const vals = arr.filter(nonNull)
        return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
      }
      gradeComparison = {
        grade: student.grade,
        peerCount: peers.length,
        peerAvgScore: avg(peerScores.map((s) => s.score)),
        peerAvgGrammar: avg(peerScores.map((s) => s.grammarScore)),
        peerAvgVocabulary: avg(peerScores.map((s) => s.vocabularyScore)),
        peerAvgReading: avg(peerScores.map((s) => s.readingScore)),
        peerAvgWriting: avg(peerScores.map((s) => s.writingScore)),
      }
    }

    // 학생 본인 평균
    const nonNull = <T>(v: T | null): v is T => v !== null
    const avg = (arr: (number | null)[]) => {
      const vals = arr.filter(nonNull)
      return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
    }
    const studentAvgScore = avg(testSessions.map((s) => s.score))
    const studentAvgGrammar = avg(testSessions.map((s) => s.grammarScore))
    const studentAvgVocab = avg(testSessions.map((s) => s.vocabularyScore))
    const studentAvgReading = avg(testSessions.map((s) => s.readingScore))
    const studentAvgWriting = avg(testSessions.map((s) => s.writingScore))
    const studentAvgListening = avg(testSessions.map((s) => s.listeningScore))

    // 연습 통계
    const practiceTotal = practiceLogs.reduce((s, l) => s + l.totalCount, 0)
    const practiceCorrect = practiceLogs.reduce((s, l) => s + l.correctCount, 0)
    const practiceAccuracy = practiceTotal > 0 ? Math.round((practiceCorrect / practiceTotal) * 100) : 0
    const domainPractice: Record<string, { total: number; correct: number }> = {}
    for (const l of practiceLogs) {
      const key = l.domain ?? 'UNKNOWN'
      if (!domainPractice[key]) domainPractice[key] = { total: 0, correct: 0 }
      domainPractice[key].total += l.totalCount
      domainPractice[key].correct += l.correctCount
    }

    // 쓰기 통계
    const writingSummary = writingLogs.map((r) => {
      const d = r.dataJson as WritingDataJson
      return {
        date: r.createdAt.toISOString().split('T')[0],
        topic: d.topicTitle ?? '',
        level: d.level ?? 0,
        cefr: d.cefrLevel ?? '',
        wordCount: d.wordCount ?? 0,
        percentage: d.percentage ?? 0,
        grammar: d.scores?.grammar?.score ?? 0,
        grammarMax: d.scores?.grammar?.maxForLevel ?? 0,
        organization: d.scores?.organization?.score ?? 0,
        orgMax: d.scores?.organization?.maxForLevel ?? 0,
        vocabulary: d.scores?.vocabulary?.score ?? 0,
        vocabMax: d.scores?.vocabulary?.maxForLevel ?? 0,
        expression: d.scores?.expression?.score ?? 0,
        expressionMax: d.scores?.expression?.maxForLevel ?? 0,
      }
    })
    const writingAvgPct = writingSummary.length > 0
      ? Math.round(writingSummary.reduce((s, w) => s + w.percentage, 0) / writingSummary.length)
      : null

    const systemPrompt = `당신은 영어교육 전문가이자 학부모 상담 전문가입니다.
아래 학생의 최근 3개월 학습 데이터를 바탕으로 학부모 상담용 상세 분석 리포트를 JSON으로 작성하세요.

반환할 JSON 구조 (한국어, 모든 필드 필수):
{
  "parentSummary": "학부모님께 드리는 종합 소견 (3~5문장, 따뜻하고 전문적인 어조)",
  "overallEvaluation": "전체 종합 평가 (3~4문장)",
  "gradeComparisonAnalysis": "동학년 학생 대비 성취도 분석 (2~3문장, 비교 데이터 기반)",
  "domainAnalysis": {
    "grammar": "문법 영역 상세 분석 (2~3문장)",
    "vocabulary": "어휘 영역 상세 분석 (2~3문장)",
    "reading": "읽기 영역 상세 분석 (2~3문장)",
    "writing": "쓰기 영역 상세 분석 (2~3문장)",
    "listening": "듣기 영역 상세 분석 (1~2문장, 데이터 없으면 보충 학습 권장)"
  },
  "writingTrend": "쓰기 활동 트렌드 분석 (2~3문장)",
  "practiceAnalysis": "연습 활동 및 학습 습관 분석 (2~3문장)",
  "strengthPoints": ["강점 1", "강점 2", "강점 3"],
  "improvementPoints": ["개선 필요 사항 1", "개선 필요 사항 2", "개선 필요 사항 3"],
  "parentRecommendations": ["학부모 가정 지도 권장 사항 1", "권장 사항 2", "권장 사항 3"],
  "studySuggestions": ["학습 제안 1", "제안 2", "제안 3", "제안 4"]
}

반드시 유효한 JSON만 반환하세요.`

    const dataText = [
      `학생명: ${student.user.name}`,
      `학년: ${student.grade ?? '미등록'}`,
      `현재 레벨: Level ${student.currentLevel}`,
      `소속 반: ${student.class?.name ?? '미배정'}`,
      '',
      `[최근 3개월 테스트 결과 (${testSessions.length}회)]`,
      `학생 평균 - 총점: ${studentAvgScore ?? '-'}, 문법: ${studentAvgGrammar ?? '-'}, 어휘: ${studentAvgVocab ?? '-'}, 읽기: ${studentAvgReading ?? '-'}, 쓰기: ${studentAvgWriting ?? '-'}, 듣기: ${studentAvgListening ?? '-'}`,
      testSessions.map((s) =>
        `  ${s.completedAt?.toISOString().split('T')[0]} [${s.test.type}] ${s.test.title}: 총점 ${s.score ?? '-'}, 문법 ${s.grammarScore ?? '-'}, 어휘 ${s.vocabularyScore ?? '-'}, 읽기 ${s.readingScore ?? '-'}, 쓰기 ${s.writingScore ?? '-'}`
      ).join('\n'),
      '',
      gradeComparison
        ? [
            `[동학년(${gradeComparison.grade}) 비교 - ${gradeComparison.peerCount}명 대비]`,
            `동학년 평균 - 총점: ${gradeComparison.peerAvgScore ?? '-'}, 문법: ${gradeComparison.peerAvgGrammar ?? '-'}, 어휘: ${gradeComparison.peerAvgVocabulary ?? '-'}, 읽기: ${gradeComparison.peerAvgReading ?? '-'}, 쓰기: ${gradeComparison.peerAvgWriting ?? '-'}`,
          ].join('\n')
        : '[동학년 비교 데이터 없음 (학년 미등록 또는 비교 대상 부족)]',
      '',
      `[연습 활동 (최근 3개월)]`,
      `총 ${practiceLogs.length}회 연습, ${practiceTotal}문제 풀이, 정답률 ${practiceAccuracy}%`,
      Object.entries(domainPractice).map(([domain, stat]) =>
        `  ${domain}: ${stat.total}문제, 정답률 ${Math.round((stat.correct / stat.total) * 100)}%`
      ).join('\n'),
      '',
      `[쓰기 활동 (최근 3개월, ${writingLogs.length}회)]`,
      writingAvgPct !== null ? `평균 점수: ${writingAvgPct}%` : '쓰기 기록 없음',
      writingSummary.map((w) =>
        `  ${w.date} [${w.cefr} Lv.${w.level}] "${w.topic}" - ${w.wordCount}단어, ${w.percentage}점 (문법${w.grammar}/${w.grammarMax}, 구성${w.organization}/${w.orgMax}, 어휘${w.vocabulary}/${w.vocabMax}, 표현${w.expression}/${w.expressionMax})`
      ).join('\n'),
      '',
      `[교사 피드백 (최근)]`,
      teacherComments.map((c) => `  ${c.teacher.name} 교사: "${c.content}"`).join('\n'),
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
    if (!rawContent) return NextResponse.json({ error: 'AI 응답을 받지 못했습니다.' }, { status: 500 })

    const result = JSON.parse(rawContent) as DetailedReportResult

    const periodEnd = new Date()
    const saved = await prisma.report.create({
      data: {
        studentId,
        generatedBy: user.id,
        type: 'AI_DETAILED',
        periodStart: threeMonthsAgo,
        periodEnd,
        dataJson: {
          ...result,
          metadata: {
            testCount: testSessions.length,
            practiceCount: practiceLogs.length,
            writingCount: writingLogs.length,
            gradeComparison,
            generatedAt: periodEnd.toISOString(),
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: result, savedId: saved.id })
  } catch (error) {
    console.error('[generate-detailed-report] error:', error)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json({ error: `OpenAI API 오류: ${error.message}` }, { status: error.status ?? 500 })
    }
    return NextResponse.json({ error: 'AI 리포트 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
