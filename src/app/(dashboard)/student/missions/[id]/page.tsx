import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { MissionPlayer } from '@/components/student/mission-player'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

// ── Types ─────────────────────────────────────────────────────────────────────

type MissionItemRaw = {
  id: string
  type: string
  title: string
  description: string
  domain: string | null
  subCategory: string | null
  questionIds: string[]
  questionCount: number
  xpReward: number
  status: string
  completedAt: string | null
  correctCount: number
  order: number
  reason: string
  answeredQuestions?: {
    questionId: string
    answer: string
    isCorrect: boolean
    xpEarned: number
  }[]
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ m?: string }>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MissionPage({ params, searchParams }: Props) {
  const { id: dailyMissionId } = await params
  const { m } = await searchParams
  const missionIndex = parseInt(m ?? '0', 10)

  if (isNaN(missionIndex) || missionIndex < 0) notFound()

  // 인증
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id, isDeleted: false },
    select: { student: { select: { id: true } } },
  })
  if (!dbUser?.student) redirect('/student')
  const studentId = dbUser.student.id

  // DailyMission 조회
  const mission = await prisma.dailyMission.findUnique({
    where: { id: dailyMissionId },
  })
  if (!mission || mission.studentId !== studentId) notFound()

  // missionsJson 파싱
  const missionsJson = (mission.missionsJson ?? []) as MissionItemRaw[]
  if (missionsJson.length === 0) {
    // 구형 미션 (missionsJson 없음) → 홈으로
    redirect('/student')
  }

  const missionItem = missionsJson[missionIndex]
  if (!missionItem) notFound()

  // 완료된 미션: 다음 미션으로 리다이렉트
  if (missionItem.status === 'COMPLETED') {
    const nextIndex = missionIndex + 1
    if (nextIndex < missionsJson.length) {
      redirect(`/student/missions/${dailyMissionId}?m=${nextIndex}`)
    }
    redirect('/student')
  }

  // 잠긴 미션: 홈으로
  if (missionItem.status === 'LOCKED') {
    redirect('/student')
  }

  // 문제 조회 (순서 보장)
  const questionIds = missionItem.questionIds
  if (questionIds.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center space-y-4">
        <div className="text-5xl">📚</div>
        <h2 className="text-xl font-bold text-gray-900">문제가 없어요</h2>
        <p className="text-gray-500">이 미션에 준비된 문제가 없습니다.</p>
        <a
          href="/student"
          className="inline-block rounded-xl bg-[#1865F2] px-6 py-3 text-sm font-semibold text-white"
        >
          홈으로
        </a>
      </div>
    )
  }

  const questionsRaw = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      domain: true,
      subCategory: true,
      difficulty: true,
      cefrLevel: true,
      contentJson: true,
    },
  })

  // ID 순서 보장
  const questions = questionIds
    .map((id) => questionsRaw.find((q) => q.id === id))
    .filter(Boolean)
    .map((q) => q!)
    .map((q) => ({
      id: q.id,
      domain: q.domain as string,
      subCategory: q.subCategory,
      difficulty: q.difficulty,
      cefrLevel: q.cefrLevel,
      contentJson: q.contentJson as QuestionContentJson,
    }))

  // 기존 응답 추출 (중간 이탈 복원)
  const existingResponses: Record<string, string> = {}
  for (const aq of missionItem.answeredQuestions ?? []) {
    existingResponses[aq.questionId] = aq.answer
  }

  // 미션 정보 정제
  const missionInfo = {
    type: missionItem.type,
    title: missionItem.title,
    reason: missionItem.reason,
    xpReward: missionItem.xpReward,
    questionCount: questions.length,
    domain: missionItem.domain,
    subCategory: missionItem.subCategory,
  }

  return (
    <MissionPlayer
      mission={missionInfo}
      questions={questions}
      existingResponses={existingResponses}
      dailyMissionId={dailyMissionId}
      missionIndex={missionIndex}
    />
  )
}
