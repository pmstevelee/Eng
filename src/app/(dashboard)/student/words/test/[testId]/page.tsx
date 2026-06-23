import { redirect } from 'next/navigation'
import { requireStudent } from '@/lib/auth-student'
import { getWordTestAssignment } from '@/app/(dashboard)/student/words/_actions'
import { WordTestClient } from './_components/word-test-client'
import type { WordTestQuestion } from '@/lib/words/test-grader'

interface Props {
  params: Promise<{ testId: string }>
}

export default async function StudentWordTestPage({ params }: Props) {
  const { testId } = await params
  await requireStudent()

  const result = await getWordTestAssignment(testId)

  if (!result.ok) {
    const code = result.error.code
    if (code === 'ALREADY_TAKEN') redirect(`/student/words/test/${testId}/result`)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 gap-3">
        <p className="text-lg font-semibold text-gray-900">
          {code === 'NOT_STARTED' ? '아직 시험이 시작되지 않았습니다.' :
           code === 'EXPIRED' ? '시험 기간이 종료되었습니다.' :
           code === 'FORBIDDEN' ? '접근 권한이 없는 시험입니다.' :
           '시험을 불러올 수 없습니다.'}
        </p>
        <p className="text-sm text-gray-400">{result.error.message}</p>
      </div>
    )
  }

  const { assignment, questions } = result.data as {
    assignment: {
      id: string
      title: string
      mode: string
      timePerQuestion: number
      numQuestions: number
      passingScore: number
    }
    questions: WordTestQuestion[]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 text-center">
        <h1 className="text-base font-semibold text-gray-900">{assignment.title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">합격 기준 {assignment.passingScore}%</p>
      </div>
      <WordTestClient assignment={assignment} questions={questions} />
    </div>
  )
}
