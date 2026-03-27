'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'

async function getAuthedTeacherOrOwner() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || !user.academyId) return null
  if (user.role !== 'TEACHER' && user.role !== 'ACADEMY_OWNER') return null
  return user
}

export type WritingGrade = {
  responseId: string
  questionId: string
  grammarScore: number
  structureScore: number
  vocabularyScore: number
  expressionScore: number
  teacherScore: number
  teacherComment: string
}

// AI 에세이 분석
export async function getAiAnalysis(
  questionText: string,
  essayText: string,
): Promise<{
  result?: {
    grammarScore: number
    structureScore: number
    vocabularyScore: number
    expressionScore: number
    total: number
    feedback: string
  }
  error?: string
}> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { error: 'AI 분석을 사용할 수 없습니다.' }

  const auth = await getAuthedTeacherOrOwner()
  if (!auth) return { error: '권한이 없습니다.' }

  const prompt = `당신은 영어 교사입니다. 학생의 영어 에세이를 채점해 주세요.

문제: ${questionText}

학생 답안:
${essayText}

다음 4가지 항목을 각 25점 만점으로 채점하고, 한국어로 종합 피드백을 작성해 주세요.
JSON 형식으로만 응답하세요:
{
  "grammarScore": <0-25>,
  "structureScore": <0-25>,
  "vocabularyScore": <0-25>,
  "expressionScore": <0-25>,
  "total": <0-100>,
  "feedback": "<한국어 피드백 2-3문장>"
}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    })

    if (!response.ok) return { error: 'AI 분석 중 오류가 발생했습니다.' }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    }
    const content = data.choices[0]?.message?.content
    if (!content) return { error: 'AI 응답을 받지 못했습니다.' }

    const parsed = JSON.parse(content) as {
      grammarScore: number
      structureScore: number
      vocabularyScore: number
      expressionScore: number
      total: number
      feedback: string
    }
    return { result: parsed }
  } catch {
    return { error: 'AI 분석 중 오류가 발생했습니다.' }
  }
}

// 세션 쓰기 채점 완료
export async function gradeSession(
  sessionId: string,
  grades: WritingGrade[],
): Promise<{ error?: string }> {
  const auth = await getAuthedTeacherOrOwner()
  if (!auth) return { error: '권한이 없습니다.' }

  // 세션 검증 (같은 학원 내 테스트인지 확인)
  const session = await prisma.testSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      grammarScore: true,
      vocabularyScore: true,
      readingScore: true,
      test: { select: { academyId: true, createdBy: true } },
    },
  })

  if (!session) return { error: '세션을 찾을 수 없습니다.' }
  if (session.test.academyId !== auth.academyId) return { error: '권한이 없습니다.' }
  if (session.status !== 'COMPLETED') return { error: '채점할 수 없는 상태입니다.' }

  try {
    await prisma.$transaction(async (tx) => {
      // 각 쓰기 응답 업데이트
      for (const grade of grades) {
        await tx.questionResponse.update({
          where: { id: grade.responseId },
          data: {
            isCorrect: grade.teacherScore >= 60, // 60점 이상 통과
            answerJson: {
              teacherScore: grade.teacherScore,
              teacherComment: grade.teacherComment,
              grammarScore: grade.grammarScore,
              structureScore: grade.structureScore,
              vocabularyScore: grade.vocabularyScore,
              expressionScore: grade.expressionScore,
            },
          },
        })
      }

      // 쓰기 점수 평균 계산
      const writingScore = grades.length > 0
        ? Math.round(grades.reduce((sum, g) => sum + g.teacherScore, 0) / grades.length)
        : null

      // 전체 점수 재계산
      const domainScores = [
        session.grammarScore,
        session.vocabularyScore,
        session.readingScore,
        writingScore,
      ].filter((s): s is number => s !== null)

      const totalScore = domainScores.length > 0
        ? Math.round(domainScores.reduce((a, b) => a + b, 0) / domainScores.length)
        : null

      // SkillAssessment - WRITING 영역 기록
      const sessionWithStudent = await tx.testSession.findUnique({
        where: { id: sessionId },
        select: { studentId: true },
      })
      if (sessionWithStudent && writingScore !== null) {
        await tx.skillAssessment.create({
          data: {
            studentId: sessionWithStudent.studentId,
            domain: 'WRITING',
            level: 1,
            score: writingScore,
            notes: '교사 채점 완료',
          },
        })
      }

      await tx.testSession.update({
        where: { id: sessionId },
        data: {
          writingScore,
          score: totalScore,
          status: 'GRADED',
        },
      })

      // 학생에게 채점 완료 알림
      const fullSession = await tx.testSession.findUnique({
        where: { id: sessionId },
        select: {
          student: { select: { userId: true } },
          test: { select: { title: true, academyId: true } },
        },
      })
      if (fullSession) {
        await tx.notification.create({
          data: {
            userId: fullSession.student.userId,
            academyId: fullSession.test.academyId,
            type: 'SUCCESS',
            title: '채점이 완료되었습니다',
            message: `"${fullSession.test.title}" 테스트 채점이 완료되었습니다. 결과를 확인해 보세요.`,
          },
        })
      }
    })

    revalidatePath(`/teacher/tests`)
    revalidateTag(`owner-${auth.academyId}-dashboard`)
    return {}
  } catch {
    return { error: '채점 저장에 실패했습니다.' }
  }
}
