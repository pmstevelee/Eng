import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      academyId: true,
      academy: {
        select: { id: true, name: true, businessName: true },
      },
    },
  })

  if (!profile) {
    return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json(profile)
}
