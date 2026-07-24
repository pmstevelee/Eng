import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { getClassesForTeacher } from '../../../actions'
import { EditWordTestForm } from './_components/edit-word-test-form'

interface Props {
  params: Promise<{ testId: string }>
}

function toLocalInputValue(date: Date | null): string {
  if (!date) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default async function TeacherWordTestEditPage({ params }: Props) {
  const { testId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const assignment = await prisma.wordTestAssignment.findFirst({
    where: { id: testId, teacherId: user.id },
    include: {
      wordSet: { select: { id: true, title: true, _count: { select: { items: true } } } },
      studentAssignments: { select: { studentId: true } },
      classAssignments: { select: { classId: true } },
    },
  })
  if (!assignment) redirect('/teacher/words/tests')

  const classes = await getClassesForTeacher()
  const classStudentMap = new Map(classes.map((c) => [c.id, c.students.map((s) => s.id)]))
  const initialStudentIds = Array.from(
    new Set([
      ...assignment.studentAssignments.map((s) => s.studentId),
      ...assignment.classAssignments.flatMap((c) => classStudentMap.get(c.classId) ?? []),
    ]),
  )

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher/words/tests"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          출제한 시험 목록으로
        </Link>
        <p className="text-sm text-gray-500 mb-1">{assignment.wordSet.title}</p>
        <h1 className="text-2xl font-bold text-gray-900">단어 시험 수정</h1>
      </div>
      <EditWordTestForm
        testId={assignment.id}
        wordCount={assignment.wordSet._count.items}
        classes={classes}
        initialTitle={assignment.title}
        initialMode={assignment.mode}
        initialTimePerQuestion={assignment.timePerQuestion.toString()}
        initialNumQuestions={assignment.numQuestions.toString()}
        initialPassingScore={assignment.passingScore.toString()}
        initialStartsAt={toLocalInputValue(assignment.startsAt)}
        initialEndsAt={toLocalInputValue(assignment.endsAt)}
        initialStudentIds={initialStudentIds}
      />
    </div>
  )
}
