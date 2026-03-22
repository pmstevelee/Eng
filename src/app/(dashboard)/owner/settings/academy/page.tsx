import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { AcademyInfoForm } from './_components/academy-info-form'

export default async function AcademySettingsPage() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: {
      role: true,
      academy: {
        select: {
          name: true,
          businessName: true,
          address: true,
          phone: true,
        },
      },
    },
  })
  if (!user || user.role !== 'ACADEMY_OWNER') redirect('/login')

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">학원 정보</h2>
        <p className="text-sm text-gray-500 mt-1">학원의 기본 정보를 수정합니다.</p>
      </div>
      <AcademyInfoForm
        businessName={user.academy?.businessName ?? user.academy?.name ?? ''}
        address={user.academy?.address ?? ''}
        phone={user.academy?.phone ?? ''}
      />
    </div>
  )
}
