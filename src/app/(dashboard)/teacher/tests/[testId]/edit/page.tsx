import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import TestFormClient from '../../new/_components/test-form-client'
import type { QuestionRow } from '@/components/shared/question-bank-client'
import {
  updateTest,
  updateDeployedStudents,
  saveTestDraft,
  createAndDeployTest,
  getStudentsForDeploy,
  getAutoQuestions,
  getTestForEdit,
  getTestQuestionDetail,
} from '../../actions'

export default async function EditTestPage({
  params,
}: {
  params: { testId: string }
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const { test, error } = await getTestForEdit(params.testId)
  if (error || !test) notFound()

  const classes = await prisma.class.findMany({
    where: { academyId: user.academyId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  const rawQuestions = await prisma.question.findMany({
    where: {
      OR: [{ academyId: user.academyId }, { academyId: null }],
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      domain: true,
      subCategory: true,
      difficulty: true,
      cefrLevel: true,
      contentJson: true,
      statsJson: true,
      createdAt: true,
      creator: { select: { name: true } },
    },
  })

  const questions: QuestionRow[] = rawQuestions.map((q) => {
    const content = q.contentJson as { type: string; question_text?: string }
    return {
      id: q.id,
      domain: q.domain,
      subCategory: q.subCategory,
      difficulty: q.difficulty,
      cefrLevel: q.cefrLevel,
      questionType: (content.type ?? 'multiple_choice') as QuestionRow['questionType'],
      questionText: content.question_text ?? '',
      statsJson: q.statsJson as QuestionRow['statsJson'],
      createdAt: q.createdAt.toISOString(),
      creator: q.creator,
    }
  })

  const boundUpdateTest = updateTest.bind(null, params.testId)
  const boundUpdateDeployedStudents = updateDeployedStudents.bind(null, params.testId)

  return (
    <TestFormClient
      classes={classes}
      questions={questions}
      saveTestDraftAction={saveTestDraft}
      createAndDeployTestAction={createAndDeployTest}
      getStudentsForDeployAction={getStudentsForDeploy}
      getAutoQuestionsAction={getAutoQuestions}
      initialData={test}
      updateTestAction={boundUpdateTest}
      updateDeployedStudentsAction={boundUpdateDeployedStudents}
      getQuestionDetailAction={getTestQuestionDetail}
      successHref="/teacher/tests"
    />
  )
}
