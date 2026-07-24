import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import type { WordTestAnswerRecord } from '@/lib/words/test-grader'

interface Props {
  params: Promise<{ setId: string; testId: string; studentId: string }>
}

export default async function OwnerWordTestStudentResultPage({ params }: Props) {
  const { setId, testId, studentId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const attempt = await prisma.wordTestAttempt.findUnique({
    where: { assignmentId_studentId: { assignmentId: testId, studentId } },
    include: {
      assignment: {
        select: { title: true, passingScore: true, mode: true, teacherId: true },
      },
      student: { include: { user: { select: { name: true } } } },
    },
  })

  if (!attempt || attempt.assignment.teacherId !== user.id) {
    redirect(`/owner/words/sets/${setId}/test/${testId}/results`)
  }

  const answers = attempt.answers as unknown as WordTestAnswerRecord[]
  const wrongAnswers = answers.filter((a) => !a.isCorrect)

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Link
        href={`/owner/words/sets/${setId}/test/${testId}/results`}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← 응시자 목록으로
      </Link>

      {/* 결과 카드 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4 ${
            attempt.isPassed
              ? 'bg-[#1FAF54]/10 text-[#1FAF54]'
              : 'bg-[#D92916]/10 text-[#D92916]'
          }`}
        >
          {attempt.score}점
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">{attempt.student.user.name}</h1>
        <p className="text-sm text-gray-500">
          {attempt.assignment.title} · {attempt.isPassed ? '합격' : '불합격'}
        </p>
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-400">정답</p>
            <p className="text-lg font-bold text-[#1FAF54]">
              {answers.filter((a) => a.isCorrect).length}개
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">오답</p>
            <p className="text-lg font-bold text-[#D92916]">{wrongAnswers.length}개</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">합격 기준</p>
            <p className="text-lg font-bold text-gray-700">{attempt.assignment.passingScore}%</p>
          </div>
        </div>
      </div>

      {/* 문항별 결과 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">문항별 결과</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {answers.map((ans, i) => (
            <div key={ans.wordId} className="flex items-start gap-3 px-4 py-3">
              <span
                className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  ans.isCorrect ? 'bg-[#1FAF54]/10 text-[#1FAF54]' : 'bg-[#D92916]/10 text-[#D92916]'
                }`}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{ans.term}</p>
                <p className="text-xs text-gray-400">{ans.meaning}</p>
                {!ans.isCorrect && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-[#D92916]">학생 답: {ans.userAnswer || '(미입력)'}</p>
                    <p className="text-xs text-[#1FAF54]">정답: {ans.correctAnswer}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
