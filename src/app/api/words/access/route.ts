import { NextRequest, NextResponse } from 'next/server'
import { canUseWordLearning } from '@/lib/words/access-guard'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ canAccess: false, reason: 'NO_SUBSCRIPTION' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const academyId = searchParams.get('academyId')

  if (!academyId) {
    return NextResponse.json({ canAccess: false, reason: 'NO_SUBSCRIPTION' })
  }

  // 요청한 academyId가 실제 본인 소속인지 검증
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { academyId: true },
  })

  if (dbUser?.academyId !== academyId) {
    return NextResponse.json({ canAccess: false, reason: 'NO_SUBSCRIPTION' }, { status: 403 })
  }

  const allowed = await canUseWordLearning(academyId)
  return NextResponse.json({
    canAccess: allowed,
    reason: allowed ? null : 'FREE_TIER',
  })
}
