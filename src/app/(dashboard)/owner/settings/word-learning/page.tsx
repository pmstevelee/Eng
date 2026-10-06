import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { parseWordLearningSettings } from '@/lib/words/settings'
import { WordLearningClient } from './_components/word-learning-client'

const getWordLearningData = (academyId: string) =>
  unstable_cache(
    () =>
      prisma.academy.findUnique({
        where: { id: academyId },
        select: { settingsJson: true },
      }),
    [`word-learning-settings-${academyId}`],
    { revalidate: 60, tags: [`academy-${academyId}`] },
  )()

export default async function WordLearningSettingsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const academy = await getWordLearningData(user.academyId)

  const settings = parseWordLearningSettings(academy?.settingsJson)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">단어학습 설정</h2>
        <p className="text-sm text-gray-500 mt-1">학원 학생들의 단어학습 조건을 설정합니다.</p>
      </div>
      <WordLearningClient initial={settings} />
    </div>
  )
}
