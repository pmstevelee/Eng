import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { ChevronLeft } from 'lucide-react'
import { OwnerSetBuilderClient } from './_components/owner-set-builder-client'
import { getClassesForOwner } from '@/app/(dashboard)/owner/words/_actions/test'

export default async function OwnerWordSetNewPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  const classes = await getClassesForOwner()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/owner/words?tab=sets"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          세트 목록으로
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">새 단어 세트 만들기</h1>
        <p className="text-sm text-gray-400 mt-1">단어를 직접 선택하거나 자동 생성 조건으로 만들 수 있습니다.</p>
      </div>
      <OwnerSetBuilderClient classes={classes} />
    </div>
  )
}
