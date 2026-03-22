import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import ScheduleClient from './_components/schedule-client'

export default async function OwnerTestSchedulePage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const tests = await prisma.test.findMany({
    where: { academyId: user.academyId, isActive: true },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      classId: true,
      createdAt: true,
      class: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Build unique class list for color mapping
  const classMap = new Map<string, string>()
  for (const t of tests) {
    if (t.classId && t.class) {
      classMap.set(t.classId, t.class.name)
    }
  }
  const classList = Array.from(classMap.entries()).map(([id, name]) => ({ id, name }))

  const scheduleTests = tests.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    status: t.status,
    classId: t.classId,
    className: t.class?.name ?? null,
    date: t.createdAt.toISOString().split('T')[0], // YYYY-MM-DD
  }))

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
          <CalendarDays size={20} className="text-primary-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">테스트 일정</h1>
          <p className="text-sm text-gray-500 mt-0.5">월별 테스트 출제 일정을 확인하세요.</p>
        </div>
      </div>

      <ScheduleClient tests={scheduleTests} classList={classList} />
    </div>
  )
}
