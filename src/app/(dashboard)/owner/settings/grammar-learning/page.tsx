import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { parseGrammarLearningSettings } from '@/lib/grammar/settings'
import { GrammarLearningClient } from './_components/grammar-learning-client'

export default async function GrammarLearningSettingsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const academy = await prisma.academy.findUnique({
    where: { id: user.academyId },
    select: { settingsJson: true },
  })
  const settings = parseGrammarLearningSettings(academy?.settingsJson ?? null)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">문법학습 설정</h2>
        <p className="mt-1 text-sm text-gray-500">학생 문법학습의 통과·숙달 기준을 정합니다. 본원과 모든 지점에 함께 적용돼요.</p>
      </div>
      <GrammarLearningClient initial={settings} />
    </div>
  )
}
