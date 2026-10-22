import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getClassesForOwner } from '@/app/(dashboard)/owner/words/_actions/test'
import { getAiFlashcardQuota } from '@/lib/words/ai-flashcard-actions'
import { AiFlashcardBuilder } from '@/components/words/ai-flashcard-builder'

// AI 생성(최대 100단어, 병렬 요청)이 서버 액션 기본 시간보다 오래 걸릴 수 있다
export const maxDuration = 60

export default async function OwnerAiFlashcardPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const [classes, quota] = await Promise.all([getClassesForOwner(), getAiFlashcardQuota()])
  if (!quota) redirect('/login')

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/owner/words?tab=sets"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"
      >
        <ChevronLeft className="w-4 h-4" />
        세트 목록으로
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 플래시카드 만들기</h1>
        <p className="mt-1 text-sm text-gray-500">
          교재·프린트의 단어를 텍스트로 올리면 AI가 뜻·영영풀이·예문을 채워 플래시카드 세트를 만들어 드립니다.
        </p>
      </div>
      <AiFlashcardBuilder classes={classes} initialQuota={quota} basePath="/owner/words" />
    </div>
  )
}
