import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { SetBuilderClient } from './_components/set-builder-client'
import { getClassesForTeacher } from '@/app/(dashboard)/teacher/words/actions'

export default async function NewWordSetPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const classes = await getClassesForTeacher()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/teacher/words"
          className="flex items-center text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          단어 세트 목록
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">새 단어 세트 만들기</h1>
        <p className="mt-1 text-sm text-gray-500">
          Oxford 단어 뱅크에서 단어를 검색해 세트를 구성하고, 학생들에게 시험을 출제하세요.
        </p>
      </div>

      <SetBuilderClient classes={classes} />
    </div>
  )
}
