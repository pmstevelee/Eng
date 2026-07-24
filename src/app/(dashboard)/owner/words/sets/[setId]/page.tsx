import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { ChevronLeft, Download, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteSetButton } from './_components/delete-set-button'

interface Props {
  params: Promise<{ setId: string }>
}

const MODE_LABELS: Record<string, string> = {
  EN_TO_KO: '영→한',
  KO_TO_EN: '한→영',
  SPELL: '스펠링',
  MIXED: '혼합',
}

export default async function OwnerWordSetPage({ params }: Props) {
  const { setId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const wordSet = await prisma.wordSet.findFirst({
    where: {
      id: setId,
      OR: [{ academyId: user.academyId }, { isPublic: true }],
    },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: { word: { select: { id: true, term: true, meaning: true, partOfSpeech: true } } },
      },
      wordTestAssignments: {
        where: { teacherId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          mode: true,
          passingScore: true,
          createdAt: true,
          _count: { select: { attempts: true } },
        },
      },
    },
  })

  if (!wordSet) redirect('/owner/words?tab=sets')

  const canDelete = wordSet.source !== 'PUBLISHER' && wordSet.academyId === user.academyId

  const wordIds = wordSet.items.map((i) => i.word.id)
  const totalWords = wordSet.items.length

  // 이 세트의 단어에 대한 학생 진행 현황 집계 (같은 학원 학생만)
  const progressRows = totalWords > 0
    ? await prisma.wordProgress.findMany({
        where: {
          wordId: { in: wordIds },
          student: { user: { academyId: user.academyId, isDeleted: false } },
        },
        include: {
          student: {
            include: { user: { select: { name: true } } },
          },
        },
      })
    : []

  // 학생별로 그룹화
  const studentProgressMap = new Map<string, { name: string; masteredCount: number; totalCount: number; stages: Record<string, number> }>()
  for (const row of progressRows) {
    const sid = row.studentId
    if (!studentProgressMap.has(sid)) {
      studentProgressMap.set(sid, {
        name: row.student.user.name ?? '(이름 없음)',
        masteredCount: 0,
        totalCount: 0,
        stages: { FLASHCARD: 0, RECALL: 0, SPELL: 0, MASTERED: 0 },
      })
    }
    const entry = studentProgressMap.get(sid)!
    entry.totalCount++
    if (row.stage === 'MASTERED') entry.masteredCount++
    entry.stages[row.stage] = (entry.stages[row.stage] ?? 0) + 1
  }

  const studentProgress = Array.from(studentProgressMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.masteredCount - a.masteredCount)

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">단어 세트</p>
            <h1 className="text-2xl font-bold text-gray-900">{wordSet.title}</h1>
            <p className="text-sm text-gray-400 mt-1">{wordSet.items.length}개 단어</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/words/${setId}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-9 text-gray-600 border-gray-200">
                <Download className="w-3.5 h-3.5 mr-1" />
                다운로드
              </Button>
            </Link>
            <Link href={`/owner/words/sets/${setId}/test/new`}>
              <Button size="sm" className="h-9 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white">
                <Plus className="w-3.5 h-3.5 mr-1" />
                시험 출제
              </Button>
            </Link>
            {canDelete && (
              <>
                <Link href={`/owner/words/sets/${setId}/edit`}>
                  <Button variant="outline" size="sm" className="h-9 text-gray-600 border-gray-200">
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    수정
                  </Button>
                </Link>
                <DeleteSetButton setId={setId} setTitle={wordSet.title} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* 학생 학습 진행 현황 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">학생 학습 진행 현황</h2>
          <span className="text-xs text-gray-400">{studentProgress.length}명 학습 중</span>
        </div>
        {studentProgress.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            아직 학습한 학생이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {studentProgress.map((s) => {
              const pct = totalWords > 0 ? Math.round((s.masteredCount / totalWords) * 100) : 0
              return (
                <div key={s.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1FAF54] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[#1FAF54] w-8 text-right">{pct}%</span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400">
                      <span>플래시카드 {s.stages['FLASHCARD'] ?? 0}</span>
                      <span>리콜 {s.stages['RECALL'] ?? 0}</span>
                      <span>스펠 {s.stages['SPELL'] ?? 0}</span>
                      <span className="text-[#1FAF54] font-medium">마스터 {s.masteredCount}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{s.masteredCount}/{totalWords}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 출제 이력 */}
      {wordSet.wordTestAssignments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">출제 이력</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {wordSet.wordTestAssignments.map((a) => (
              <Link
                key={a.id}
                href={`/owner/words/sets/${setId}/test/${a.id}/results`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.title}</p>
                  <p className="text-xs text-gray-400">
                    {MODE_LABELS[a.mode]} · 합격 {a.passingScore}% ·{' '}
                    {a.createdAt.toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                  {a._count.attempts}명 응시
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 단어 목록 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">단어 목록</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {wordSet.items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xs text-gray-300 w-5 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <p className="text-sm font-medium text-gray-900">{item.word.term}</p>
                <p className="text-sm text-gray-500">{item.word.meaning}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
