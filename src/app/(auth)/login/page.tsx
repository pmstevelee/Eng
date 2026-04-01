import { prisma } from '@/lib/prisma/client'
import LoginForm from './login-form'

async function getAcademyName(): Promise<string> {
  try {
    const academy = await prisma.academy.findFirst({
      select: { businessName: true, name: true },
      orderBy: { createdAt: 'asc' },
    })
    return academy?.businessName || academy?.name || 'IVY LMS'
  } catch {
    return 'IVY LMS'
  }
}

export default async function LoginPage() {
  const academyName = await getAcademyName()

  return <LoginForm academyName={academyName} />
}
