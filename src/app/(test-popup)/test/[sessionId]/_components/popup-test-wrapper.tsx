'use client'

import { useRouter } from 'next/navigation'
import { TestTakingClient } from '@/app/(dashboard)/student/tests/[sessionId]/_components/test-taking-client'
import { saveResponses, submitTest } from '@/app/(dashboard)/student/tests/[sessionId]/actions'
import type { SessionForTest, TestForTest, QuestionForTest, InitialAnswers } from '@/app/(dashboard)/student/tests/[sessionId]/page'

type Props = {
  session: SessionForTest
  test: TestForTest
  questions: QuestionForTest[]
  initialAnswers: InitialAnswers
}

export function PopupTestWrapper({ session, test, questions, initialAnswers }: Props) {
  const router = useRouter()

  async function handleSubmit(
    sessionId: string,
    allAnswers: { questionId: string; answer: string }[],
  ) {
    const result = await submitTest(sessionId, allAnswers)
    if (!result?.error) {
      router.push(`/student/tests/${sessionId}/result`)
    }
    return result ?? {}
  }

  return (
    <TestTakingClient
      session={session}
      test={test}
      questions={questions}
      initialAnswers={initialAnswers}
      onSaveResponses={saveResponses}
      onSubmit={handleSubmit}
    />
  )
}
