import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { WordLearningClient } from './_components/word-learning-client'

const DEFAULT_DAILY_NEW_WORDS = 10

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

  const json =
    academy?.settingsJson &&
    typeof academy.settingsJson === 'object' &&
    !Array.isArray(academy.settingsJson)
      ? (academy.settingsJson as Record<string, unknown>)
      : {}

  const wordLearning =
    json.wordLearning &&
    typeof json.wordLearning === 'object' &&
    !Array.isArray(json.wordLearning)
      ? (json.wordLearning as Record<string, unknown>)
      : {}

  const dailyNewWords =
    typeof wordLearning.dailyNewWords === 'number'
      ? wordLearning.dailyNewWords
      : DEFAULT_DAILY_NEW_WORDS

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">단어학습 설정</h2>
        <p className="text-sm text-gray-500 mt-1">학원 학생들의 단어학습 조건을 설정합니다.</p>
      </div>
      <WordLearningClient initialDailyNewWords={dailyNewWords} />
    </div>
  )
}
