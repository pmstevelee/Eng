import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { AcademyInfoForm } from './_components/academy-info-form'

export default async function AcademySettingsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) redirect('/login')

  const academyId = user.academyId

  const academy = await unstable_cache(
    () =>
      prisma.academy.findUnique({
        where: { id: academyId },
        select: { name: true, businessName: true, address: true, phone: true },
      }),
    [`academy-info-${academyId}`],
    { revalidate: 60, tags: [`academy-${academyId}`] },
  )()

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">학원 정보</h2>
        <p className="text-sm text-gray-500 mt-1">학원의 기본 정보를 수정합니다.</p>
      </div>
      <AcademyInfoForm
        businessName={academy?.businessName ?? academy?.name ?? ''}
        address={academy?.address ?? ''}
        phone={academy?.phone ?? ''}
      />
    </div>
  )
}
