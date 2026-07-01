import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { Button } from '@/components/ui/button'
import { BookOpen, Plus, BarChart2, Pencil } from 'lucide-react'
import { DeleteSetButton } from './_components/delete-set-button'

const SOURCE_LABEL: Record<string, string> = {
  PUBLISHER: '시스템',
  TEACHER: '교사 제작',
  AI_GENERATED: 'AI 자동',
  OXFORD_3000: 'Oxford 3000',
  OXFORD_5000: 'Oxford 5000',
}

const CEFR_MAP: Record<number, string> = {
  1: 'Pre-A1', 2: 'A1', 3: 'A1+', 4: 'A2', 5: 'A2+',
  6: 'B1', 7: 'B1+', 8: 'B2', 9: 'B2+', 10: 'C1',
}

export default async function TeacherWordsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER' || !user.academyId) redirect('/login')

  const wordSets = await prisma.wordSet.findMany({
    where: {
      OR: [{ academyId: user.academyId }, { isPublic: true }, { ownerId: user.id }],
    },
    select: {
      id: true,
      title: true,
      cefrLevel: true,
      source: true,
      _count: { select: { items: true, wordTestAssignments: true } },
    },
    orderBy: [{ source: 'asc' }, { cefrLevel: 'asc' }],
  })

  // 시스템 세트 / 교사 세트 분리
  const systemSets = wordSets.filter((s) => s.source === 'PUBLISHER')
  const teacherSets = wordSets.filter((s) => s.source !== 'PUBLISHER')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">단어 세트 관리</h1>
        <div className="flex items-center gap-2">
          <Link href="/teacher/words/report">
            <Button variant="outline" size="sm" className="h-9 gap-2 text-[#1865F2] border-[#1865F2]/30 hover:bg-[#EFF4FE]">
              <BarChart2 className="w-4 h-4" />
              학습 리포트
            </Button>
          </Link>
          <Link href="/teacher/words/sets/new">
            <Button size="sm" className="h-9 gap-2 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white">
              <Plus className="w-4 h-4" />
              세트 만들기
            </Button>
          </Link>
        </div>
      </div>

      {/* 교사 제작 세트 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">내가 만든 세트</h2>
          <Link href="/teacher/words/sets/new" className="text-xs text-[#1865F2] font-medium hover:underline">
            + 새 세트
          </Link>
        </div>
        {teacherSets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400 mb-3">아직 만든 세트가 없습니다.</p>
            <Link href="/teacher/words/sets/new">
              <Button size="sm" className="h-9 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white">
                <Plus className="w-4 h-4 mr-1" />
                첫 세트 만들기
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {teacherSets.map((set) => (
              <div
                key={set.id}
                className="rounded-xl border border-gray-200 bg-white px-5 py-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-[#7854F7] bg-[#7854F7]/10 px-2 py-0.5 rounded-full">
                      {SOURCE_LABEL[set.source] ?? set.source}
                    </span>
                    <span className="text-xs text-gray-400">
                      {CEFR_MAP[set.cefrLevel] ?? `Lv${set.cefrLevel}`}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{set.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {set._count.items}단어 · 시험 출제 {set._count.wordTestAssignments}회
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <DeleteSetButton setId={set.id} setTitle={set.title} />
                  <Link href={`/teacher/words/sets/${set.id}`}>
                    <Button variant="outline" size="sm" className="h-9 text-gray-600 border-gray-200">
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      보기
                    </Button>
                  </Link>
                  <Link href={`/teacher/words/sets/${set.id}/test/new`}>
                    <Button size="sm" className="h-9 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white">
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      시험 출제
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 시스템 기본 세트 */}
      {systemSets.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Oxford 기본 제공 세트
            <span className="ml-2 text-xs font-normal text-gray-400">(시스템 자동 생성)</span>
          </h2>
          <div className="space-y-2">
            {systemSets.map((set) => (
              <div
                key={set.id}
                className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-[#1865F2] bg-[#1865F2]/10 px-2 py-0.5 rounded-full">
                      {CEFR_MAP[set.cefrLevel] ?? `Lv${set.cefrLevel}`}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{set.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {set._count.items}단어 · 시험 출제 {set._count.wordTestAssignments}회
                  </p>
                </div>
                <Link href={`/teacher/words/sets/${set.id}/test/new`}>
                  <Button size="sm" className="h-9 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white shrink-0">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    시험 출제
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {wordSets.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-400 mb-1">등록된 단어가 없습니다.</p>
          <p className="text-xs text-gray-300">Oxford 단어 시드를 먼저 실행하세요.</p>
        </div>
      )}
    </div>
  )
}
