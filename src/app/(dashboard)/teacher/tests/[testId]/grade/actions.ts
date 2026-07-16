'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'

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
  aiReportJson: WritingAiReport | null
}

// 쓰기 평가 리포트 항목 (구성/문법/어휘/표현력 공통 구조)
export type WritingAiReportSection = {
  score: number // 0~25
  level: number // 1~10, 이 항목만 놓고 본 레벨
  cefr: string
  feedback: string // 학생 레벨에 맞춘 눈높이 설명 (2~3문장)
  strengths: string[] // 잘한 점 1~3개
  improvements: string[] // 향상을 위한 구체적 실천 방법 1~3개
}

export type WritingAiReport = {
  totalScore: number // 0~100
  overallLevel: number // 1~10
  overallCefr: string
  summary: string // 총평 2~3문장
  organization: WritingAiReportSection // 구성
  grammar: WritingAiReportSection // 문법
  vocabulary: WritingAiReportSection // 어휘
  expression: WritingAiReportSection // 표현력
  nextStepTip: string // 다음 글쓰기에서 바로 시도해볼 구체적 제안 1개
}

const LEVEL_GUIDE = `- Level 1 (Pre-A1, 입문): 알파벳/단어 수준, 문장 구성 불가
- Level 2 (A1 하, 기초 하): be동사, 현재시제, 단어 나열
- Level 3 (A1 상, 기초 상): 기초 문장 구성, I am/I like 수준
- Level 4 (A2 하, 초급 하): 과거시제 시도, 전치사, 2~3문장 연결
- Level 5 (A2 상, 초급 상): and/but/because 연결, 짧은 단락, 일상 주제
- Level 6 (B1 하, 중급 하): 연결어(however, also), 의견 표현, 서론-본론-결론 시도
- Level 7 (B1 상, 중급 상): 관계대명사, 완료시제, 논리적 단락, 이유+예시
- Level 8 (B2 하, 중상급 하): 복문/가정법, 추상적 주제, 다양한 어휘, 비교/대조
- Level 9 (B2 상, 중상급 상): 정교한 문장, 학술 어휘, 비판적 사고, 수사적 기법
- Level 10 (C1+, 고급): 네이티브급, 뉘앙스 구분, 학술적 글쓰기`

// AI 쓰기 평가 리포트 생성 (구성/문법/어휘/표현력 4개 영역, 레벨에 맞춘 설명)
export async function getAiAnalysis(
  questionText: string,
  essayText: string,
  studentLevel: number,
): Promise<{
  result?: WritingAiReport
  error?: string
}> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { error: 'AI 분석을 사용할 수 없습니다.' }

  const auth = await getAuthedTeacherOrOwner()
  if (!auth) return { error: '권한이 없습니다.' }

  const level = Number.isFinite(studentLevel) ? Math.min(10, Math.max(1, studentLevel)) : 5

  const systemPrompt = `너는 20년 경력의 영어 교육 평가 전문가야. 한국 영어학원 학생의 영어 에세이를 채점하고, 학생이 실제로 글쓰기 실력을 향상시킬 수 있도록 구체적인 리포트를 작성해.

핵심 원칙:
1. 10단계 레벨 체계(Level 1~10)를 기준으로 채점해.
2. 구성(organization), 문법(grammar), 어휘(vocabulary), 표현력(expression) 4개 영역을 각각 독립적으로 평가해.
3. 피드백은 학생의 현재 레벨(Level ${level})에 맞는 눈높이로 설명해. 너무 어려운 문법 용어 대신 학생이 이해할 수 있는 말로 풀어서 설명해.
4. 비판만 하지 말고 잘한 점(strengths)을 반드시 함께 언급해.
5. 개선 방법(improvements)은 추상적인 조언이 아니라 다음 글쓰기에서 바로 실천할 수 있는 구체적인 행동으로 제시해.
6. 반드시 JSON으로만 응답해. 모든 텍스트는 한국어로 작성해 (예문/인용은 영어 가능).`

  const userPrompt = `아래 학생의 영어 에세이를 평가해줘. 이 학생의 현재 종합 레벨은 Level ${level}이야.

## 10단계 레벨 기준
${LEVEL_GUIDE}

## 문제
${questionText}

## 학생 답안
${essayText}

## 응답 (JSON, 한국어)
{
  "totalScore": 4개 영역 점수 합산 (0~100 정수),
  "overallLevel": 종합 레벨 (1~10 정수),
  "overallCefr": "종합 CEFR (예: A2 하)",
  "summary": "이 에세이에 대한 총평. 전반적 인상과 현재 레벨 대비 강약점을 2~3문장으로 (학생에게 직접 말하는 톤)",
  "organization": {
    "score": 0~25 정수,
    "level": 구성력만 놓고 본 레벨 (1~10),
    "cefr": "해당 레벨 CEFR",
    "feedback": "서론-본론-결론 구조, 문단 연결, 논리 전개를 Level ${level} 학생이 이해하기 쉽게 설명 (2~3문장)",
    "strengths": ["구성 측면에서 잘한 점 1~3개"],
    "improvements": ["다음 글쓰기에서 바로 실천할 구체적 방법 1~3개"]
  },
  "grammar": {
    "score": 0~25 정수,
    "level": 문법만 놓고 본 레벨 (1~10),
    "cefr": "해당 레벨 CEFR",
    "feedback": "시제, 문장 구조, 어순 등 문법 사용을 Level ${level} 학생이 이해하기 쉽게 설명 (2~3문장). 실제 오류 예시가 있으면 언급",
    "strengths": ["문법 측면에서 잘한 점 1~3개"],
    "improvements": ["다음 글쓰기에서 바로 실천할 구체적 방법 1~3개"]
  },
  "vocabulary": {
    "score": 0~25 정수,
    "level": 어휘만 놓고 본 레벨 (1~10),
    "cefr": "해당 레벨 CEFR",
    "feedback": "단어 선택의 다양성과 정확성을 Level ${level} 학생이 이해하기 쉽게 설명 (2~3문장)",
    "strengths": ["어휘 측면에서 잘한 점 1~3개"],
    "improvements": ["다음 글쓰기에서 바로 실천할 구체적 방법 1~3개 (예: 대체 가능한 상위 레벨 단어 제안)"]
  },
  "expression": {
    "score": 0~25 정수,
    "level": 표현력만 놓고 본 레벨 (1~10),
    "cefr": "해당 레벨 CEFR",
    "feedback": "문장의 다양성, 자연스러움, 독창성을 Level ${level} 학생이 이해하기 쉽게 설명 (2~3문장)",
    "strengths": ["표현력 측면에서 잘한 점 1~3개"],
    "improvements": ["다음 글쓰기에서 바로 실천할 구체적 방법 1~3개"]
  },
  "nextStepTip": "다음 에세이를 쓸 때 바로 시도해볼 수 있는 가장 중요한 팁 1개 (구체적이고 실천 가능하게)"
}

주의사항:
- Level 1~3 학생에게는 용어를 최대한 쉽게 풀어 쓰고 칭찬 위주로 작성해.
- strengths와 improvements는 반드시 이 학생의 실제 답안 내용에 근거해서 작성해 (일반론 금지).
- JSON 외 다른 텍스트 절대 금지.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
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

    const parsed = JSON.parse(content) as WritingAiReport
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
      test: { select: { id: true, academyId: true, createdBy: true } },
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
              aiReport: grade.aiReportJson,
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
    revalidatePath(`/owner/tests`)
    revalidatePath(`/owner/tests/${session.test.id}`)
    revalidateTag(`owner-${auth.academyId}-dashboard`)
    revalidateTag(`academy-${auth.academyId}-tests`)
    revalidateTag(`test-${session.test.id}`)
    logActivity({
      userId: auth.id,
      role: auth.role,
      academyId: auth.academyId,
      action: ACTIVITY_ACTIONS.TEST_GRADE,
      metadata: { sessionId, testId: session.test.id },
    }).catch(console.error)
    return {}
  } catch {
    return { error: '채점 저장에 실패했습니다.' }
  }
}
