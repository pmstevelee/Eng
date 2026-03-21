import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { Users, FileText, BarChart2, Search } from 'lucide-react'

export default async function TeacherStudentsPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { academyId: true },
  })
  if (!dbUser?.academyId) redirect('/login')

  // 내 반 학생 + 학원 전체 학생
  const students = await prisma.student.findMany({
    where: {
      user: { academyId: dbUser.academyId, isActive: true },
      status: 'ACTIVE',
    },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { name: true } },
    },
    orderBy: { user: { name: 'asc' } },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">학생 학습관리</h1>
        <p className="text-sm text-gray-500 mt-1">학생별 성적 리포트를 확인하고 다운로드합니다</p>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users size={18} className="text-primary-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">전체 학생</p>
              <p className="text-2xl font-bold text-gray-900">{students.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <BarChart2 size={18} className="text-accent-green" />
            </div>
            <div>
              <p className="text-xs text-gray-500">활성 학생</p>
              <p className="text-2xl font-bold text-gray-900">{students.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <FileText size={18} className="text-accent-purple" />
            </div>
            <div>
              <p className="text-xs text-gray-500">리포트 발행 가능</p>
              <p className="text-2xl font-bold text-gray-900">{students.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 학생 목록 */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">학생 목록</h2>
        </div>

        {students.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">학생이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-700/10 flex items-center justify-center text-primary-700 font-semibold text-sm">
                    {student.user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{student.user.name}</p>
                    <p className="text-xs text-gray-500">
                      {student.class?.name ?? '반 미배정'} · Level {student.currentLevel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/teacher/students/${student.id}/report`}
                    className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium text-primary-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <FileText size={13} />
                    리포트
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
