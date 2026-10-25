import { notFound } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { getGrammarPointByCode } from '@/lib/grammar/curriculum'
import { GrammarComingSoon } from '../_components/coming-soon'

// 단원 학습 화면은 2-2에서 만든다. 지금은 단원 정보와 준비 중 안내만 보여 준다.
export default async function StudentGrammarUnitPage({ params }: { params: { code: string } }) {
  const [{ user }, point] = await Promise.all([requireStudent(), getGrammarPointByCode(decodeURIComponent(params.code))])
  if (!point || point.status !== 'PUBLISHED' || (point.academyId !== null && point.academyId !== user.academyId)) {
    notFound()
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500">
          {point.parentCategory ? `${point.parentCategory.name} · ` : ''}
          {point.category.name}
        </p>
        <h2 className="mt-1 text-xl font-bold text-gray-900">{point.title}</h2>
        {point.summary && <p className="mt-1 text-sm text-gray-600">{point.summary}</p>}
      </div>
      <GrammarComingSoon
        icon={BookOpen}
        title="단원 학습 화면을 준비하고 있어요"
        description="개념 → 연습 → 확인 테스트 순서로 배우는 화면이 곧 열려요."
      />
    </div>
  )
}
