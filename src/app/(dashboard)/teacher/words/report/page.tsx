import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Users } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getClassWordStats, getTeacherClasses } from '../_actions/report'
import { ClassWordReport } from '../_components/class-word-report'

export default async function TeacherWordReportPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'TEACHER') redirect('/login')

  const { classId } = await searchParams

  const classes = await getTeacherClasses()
  const selectedClassId = classId ?? classes[0]?.id

  const stats = selectedClassId ? await getClassWordStats(selectedClassId) : null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/teacher/words" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">단어학습 리포트</h1>
          <p className="text-sm text-gray-400 mt-0.5">반별 학습 현황을 확인하세요</p>
        </div>
      </div>

      {/* 반 선택 */}
      <div className="flex gap-2 flex-wrap">
        {classes.map((cls) => (
          <Link
            key={cls.id}
            href={`/teacher/words/report?classId=${cls.id}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              selectedClassId === cls.id
                ? 'bg-[#0C2340] text-white border-[#0C2340]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {cls.name}
            <span className="text-xs opacity-60">({cls._count.students}명)</span>
          </Link>
        ))}
        {classes.length === 0 && (
          <p className="text-sm text-gray-400">배정된 반이 없습니다.</p>
        )}
      </div>

      {/* 리포트 내용 */}
      {stats ? (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <ClassWordReport stats={stats} />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white flex flex-col items-center justify-center py-20 text-gray-400">
          <BookOpen className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">반을 선택하면 리포트가 표시됩니다.</p>
        </div>
      )}
    </div>
  )
}
