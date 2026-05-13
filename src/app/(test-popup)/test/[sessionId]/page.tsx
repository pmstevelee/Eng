import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import { AdaptiveTestClient } from '@/app/(dashboard)/student/tests/[sessionId]/_components/adaptive-test-client'
import { PopupTestWrapper } from './_components/popup-test-wrapper'
import type {
  SessionForTest,
  TestForTest,
  QuestionForTest,
  InitialAnswers,
} from '@/app/(dashboard)/student/tests/[sessionId]/page'

export default async function PopupTestPage({
  params,
}: {
  params: { sessionId: string }
}) {
  const { sessionId } = params
  const { user, studentId } = await requireStudent()

  const session = await prisma.testSession.findUnique({
    where: { id: sessionId, studentId },
    include: {
      test: {
        select: {
          id: true,
          title: true,
          type: true,
          instructions: true,
          timeLimitMin: true,
          totalScore: true,
          questionOrder: true,
          isAdaptive: true,
          adaptiveConfig: true,
        },
      },
      questionResponses: {
        select: { questionId: true, answer: true },
      },
    },
  })

  if (!session) notFound()

  // 적응형 테스트
  if (session.test.isAdaptive) {
    return (
      <div className="h-screen overflow-y-auto bg-gray-50">
        <AdaptiveTestClient
          sessionId={sessionId}
          studentName={user.name ?? '학생'}
          testTitle={session.test.title}
          isPopup
        />
      </div>
    )
  }

  // 완료/채점된 경우
  if (session.status === 'COMPLETED' || session.status === 'GRADED') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <p className="text-lg font-bold text-gray-900">테스트가 완료되었습니다.</p>
          <a
            href={`/student/tests/${sessionId}/result`}
            className="inline-block rounded-xl bg-[#1865F2] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1558d6]"
            target="_top"
          >
            결과 보기
          </a>
        </div>
      </div>
    )
  }

  // 문제 데이터
  const questionIds = (session.test.questionOrder as string[]) || []
  const questionsRaw = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, domain: true, contentJson: true },
  })
  const questionMap = new Map(questionsRaw.map((q) => [q.id, q]))
  const questions: QuestionForTest[] = questionIds
    .map((id) => questionMap.get(id))
    .filter((q): q is NonNullable<typeof q> => q !== undefined)
    .map((q) => ({
      id: q.id,
      domain: q.domain,
      contentJson: q.contentJson as QuestionContentJson,
    }))

  const initialAnswers: InitialAnswers = {}
  for (const r of session.questionResponses) {
    if (r.answer) initialAnswers[r.questionId] = r.answer
  }

  const sessionData: SessionForTest = {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    timeLimitMin: session.timeLimitMin,
    currentQuestionIdx: session.currentQuestionIdx,
    lastSavedAt: session.lastSavedAt?.toISOString() ?? null,
  }

  const testData: TestForTest = {
    id: session.test.id,
    title: session.test.title,
    type: session.test.type,
    instructions: session.test.instructions,
    timeLimitMin: session.test.timeLimitMin,
    totalScore: session.test.totalScore,
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      <PopupTestWrapper
        session={sessionData}
        test={testData}
        questions={questions}
        initialAnswers={initialAnswers}
      />
    </div>
  )
}
