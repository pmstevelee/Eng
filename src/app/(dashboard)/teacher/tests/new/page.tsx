import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import TestFormClient from './_components/test-form-client'
import type { QuestionRow } from '@/components/shared/question-bank-client'
import {
  saveTestDraft,
  createAndDeployTest,
  getStudentsForDeploy,
  getAutoQuestions,
} from '../actions'

export default async function NewTestPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  // 학급 목록
  const classes = await prisma.class.findMany({
    where: { academyId: user.academyId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  // 문제 뱅크 전체
  const rawQuestions = await prisma.question.findMany({
    where: { academyId: user.academyId },
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

  return (
    <TestFormClient
      classes={classes}
      questions={questions}
      saveTestDraftAction={saveTestDraft}
      createAndDeployTestAction={createAndDeployTest}
      getStudentsForDeployAction={getStudentsForDeploy}
      getAutoQuestionsAction={getAutoQuestions}
    />
  )
}
