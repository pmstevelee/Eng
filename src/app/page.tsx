import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import type { Role } from '@/types'

const ROLE_REDIRECT: Record<Role, string> = {
  SUPER_ADMIN: '/admin',
  ACADEMY_OWNER: '/owner',
  TEACHER: '/teacher',
  STUDENT: '/student',
}

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 미인증 → 로그인 페이지
  if (!user) redirect('/login')

  // 인증됨 → 역할별 대시보드로
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  })

  if (!profile) redirect('/login')

  redirect(ROLE_REDIRECT[profile.role as Role])
}
