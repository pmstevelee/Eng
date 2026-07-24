import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { SupplementaryButton } from './_components/supplementary-button'
import type { WordTestAnswerRecord } from '@/lib/words/test-grader'

interface Props {
  params: Promise<{ setId: string; testId: string }>
}

const MODE_LABELS: Record<string, string> = {
  EN_TO_KO: '영어→한국어',
  KO_TO_EN: '한국어→영어',
  SPELL: '스펠링',
  MIXED: '혼합',
}

export default async function OwnerWordTestResultsPage({ params }: Props) {
  const { setId, testId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const assignment = await prisma.wordTestAssignment.findFirst({
    where: { id: testId, teacherId: user.id },
    include: {
      wordSet: { select: { title: true } },
      classAssignments: {
        include: {
          class: {
            select: {
              id: true,
              name: true,
              students: { where: { status: 'ACTIVE' }, include: { user: { select: { name: true } } } },
            },
          },
        },
      },
      studentAssignments: {
        include: { student: { include: { user: { select: { name: true } } } } },
      },
      attempts: {
        include: {
          student: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { takenAt: 'asc' },
      },
    },
  })

  if (!assignment) redirect(`/owner/words/sets/${setId}`)

  // 시험출제 대상 학생 (반 배정 + 개별 배정, 중복 제거)
  const targetStudents = new Map<string, string>()
  for (const sa of assignment.studentAssignments) {
    targetStudents.set(sa.studentId, sa.student.user.name ?? '')
  }
  for (const ca of assignment.classAssignments) {
    for (const st of ca.class.students) {
      if (!targetStudents.has(st.id)) targetStudents.set(st.id, st.user.name ?? '')
    }
  }

  const attemptsByStudentId = new Map(assignment.attempts.map((a) => [a.studentId, a]))

  const rows = Array.from(targetStudents.entries())
    .map(([studentId, name]) => {
      const attempt = attemptsByStudentId.get(studentId) ?? null
      const answers = attempt ? (attempt.answers as unknown as WordTestAnswerRecord[]) : null
      return {
        studentId,
        name,
        attempt,
        correctCount: answers ? answers.filter((a) => a.isCorrect).length : null,
        wrongCount: answers ? answers.filter((a) => !a.isCorrect).length : null,
      }
    })
    .sort((a, b) => {
      if (a.attempt && b.attempt) return a.attempt.takenAt.getTime() - b.attempt.takenAt.getTime()
      if (a.attempt) return -1
      if (b.attempt) return 1
      return a.name.localeCompare(b.name)
    })

  // 문항별 정답률 계산
  const wordStats = new Map<string, { term: string; meaning: string; correct: number; total: number }>()
  for (const attempt of assignment.attempts) {
    const answers = attempt.answers as unknown as WordTestAnswerRecord[]
    for (const ans of answers) {
      const existing = wordStats.get(ans.wordId) ?? { term: ans.term, meaning: ans.meaning, correct: 0, total: 0 }
      wordStats.set(ans.wordId, {
        ...existing,
        correct: existing.correct + (ans.isCorrect ? 1 : 0),
        total: existing.total + 1,
      })
    }
  }

  const wordStatsArr = Array.from(wordStats.entries())
    .map(([wordId, s]) => ({
      wordId,
      ...s,
      rate: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    }))
    .sort((a, b) => a.rate - b.rate)

  const avgScore =
    assignment.attempts.length > 0
      ? Math.round(assignment.attempts.reduce((s, a) => s + a.score, 0) / assignment.attempts.length)
      : null

  const passCount = assignment.attempts.filter((a) => a.isPassed).length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <p className="text-sm text-gray-500 mb-1">
          {assignment.wordSet.title} · {MODE_LABELS[assignment.mode]}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          {assignment.classAssignments.map((ca) => (
            <span
              key={ca.class.id}
              className="text-xs bg-[#1865F2]/10 text-[#1865F2] px-2 py-0.5 rounded-full font-medium"
            >
              {ca.class.name}
            </span>
          ))}
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            합격 기준 {assignment.passingScore}%
          </span>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">대상 학생</p>
          <p className="text-2xl font-bold text-gray-900">{rows.length}명</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">응시자</p>
          <p className="text-2xl font-bold text-gray-900">{assignment.attempts.length}명</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">평균 점수</p>
          <p className="text-2xl font-bold text-gray-900">{avgScore !== null ? `${avgScore}점` : '-'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">합격자</p>
          <p className="text-2xl font-bold text-[#1FAF54]">
            {passCount}명
          </p>
        </div>
      </div>

      {/* 응시자 목록 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">응시자 현황</h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400">배정된 학생이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-2.5 font-medium">학생</th>
                <th className="text-center px-4 py-2.5 font-medium">정답</th>
                <th className="text-center px-4 py-2.5 font-medium">오답</th>
                <th className="text-center px-4 py-2.5 font-medium">점수</th>
                <th className="text-center px-4 py-2.5 font-medium">결과</th>
                <th className="text-center px-4 py-2.5 font-medium">응시일</th>
                <th className="text-right px-4 py-2.5 font-medium">오답 보충</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.studentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.attempt ? (
                      <Link
                        href={`/owner/words/sets/${setId}/test/${testId}/results/${row.studentId}`}
                        className="hover:underline hover:text-[#1865F2]"
                      >
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-[#1FAF54]">
                    {row.correctCount !== null ? `${row.correctCount}개` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-[#D92916]">
                    {row.wrongCount !== null ? `${row.wrongCount}개` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center font-bold">
                    {row.attempt ? (
                      <span className={row.attempt.isPassed ? 'text-[#1FAF54]' : 'text-[#D92916]'}>
                        {row.attempt.score}점
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.attempt ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          row.attempt.isPassed
                            ? 'bg-[#1FAF54]/10 text-[#1FAF54]'
                            : 'bg-[#D92916]/10 text-[#D92916]'
                        }`}
                      >
                        {row.attempt.isPassed ? '합격' : '불합격'}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                        미응시
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {row.attempt ? row.attempt.takenAt.toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.attempt && row.wrongCount ? (
                      <SupplementaryButton
                        assignmentId={assignment.id}
                        studentId={row.studentId}
                        studentName={row.name}
                      />
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 문항별 정답률 */}
      {wordStatsArr.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">문항별 정답률 (낮은 순)</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {wordStatsArr.map((stat) => (
              <div key={stat.wordId} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{stat.term}</p>
                  <p className="text-xs text-gray-400 truncate">{stat.meaning}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stat.rate >= 70 ? 'bg-[#1FAF54]' : stat.rate >= 40 ? 'bg-[#FFB100]' : 'bg-[#D92916]'}`}
                      style={{ width: `${stat.rate}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold w-10 text-right ${stat.rate >= 70 ? 'text-[#1FAF54]' : stat.rate >= 40 ? 'text-[#FFB100]' : 'text-[#D92916]'}`}>
                    {stat.rate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
