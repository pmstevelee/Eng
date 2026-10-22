'use server'

import { prisma } from '@/lib/prisma/client'
import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { PLAN_TYPE_LABEL, getPlanTypeLimits, isSelectablePlanType } from '@/lib/plan-types'
import { getCurrentUser } from '@/lib/auth'
import { deleteOrphanAuthAccounts } from '@/lib/account/multi-academy'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')
}

export type AcademyActionResult = { ok: true; message: string } | { ok: false; error: string }

function formatDate(d: Date): string {
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
}

/** 학원 구독 정보가 바뀐 뒤 관리자·학원장·학생 화면 캐시를 모두 무효화한다. */
async function revalidateAcademySubscription(academyId: string) {
  revalidatePath(`/admin/academies/${academyId}`)
  revalidatePath('/admin/academies')
  // 학원장 구독 페이지·학생 단어학습 접근 캐시
  revalidateTag(`academy-${academyId}-subscription`)
  revalidateTag(`academy-${academyId}`)
  // 학원장 계정 페이지(요금제 표시)는 사용자 태그로 캐시됨
  const owners = await prisma.user.findMany({
    where: { academyId, role: 'ACADEMY_OWNER', isDeleted: false },
    select: { id: true },
  })
  owners.forEach((o) => revalidateTag(`user-${o.id}`))
}

export async function extendSubscription(formData: FormData): Promise<AcademyActionResult> {
  await requireAdmin()

  const academyId = formData.get('academyId')
  const months = Number(formData.get('months'))
  if (typeof academyId !== 'string' || !academyId) return { ok: false, error: '학원 정보가 없습니다.' }
  if (!Number.isInteger(months) || months < 1 || months > 36) {
    return { ok: false, error: '연장 기간을 다시 선택해주세요.' }
  }

  try {
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
      select: { subscriptionExpiresAt: true, subscriptionStartedAt: true },
    })
    if (!academy) return { ok: false, error: '학원을 찾을 수 없습니다.' }

    const now = new Date()
    const base = academy.subscriptionExpiresAt && academy.subscriptionExpiresAt > now
      ? academy.subscriptionExpiresAt
      : now
    const newExpiry = new Date(base)
    newExpiry.setMonth(newExpiry.getMonth() + months)

    await prisma.academy.update({
      where: { id: academyId },
      data: {
        subscriptionExpiresAt: newExpiry,
        subscriptionStatus: 'ACTIVE',
        // 처음 유료 전환되는 경우 구독 시작일 기록
        ...(academy.subscriptionStartedAt ? {} : { subscriptionStartedAt: now }),
      },
    })

    await revalidateAcademySubscription(academyId)
    return { ok: true, message: `구독이 ${months}개월 연장되었습니다. 새 만료일: ${formatDate(newExpiry)}` }
  } catch (e) {
    console.error('[extendSubscription]', e)
    return { ok: false, error: '구독 연장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }
}

export async function changePlan(formData: FormData): Promise<AcademyActionResult> {
  await requireAdmin()

  const academyId = formData.get('academyId')
  const plan = formData.get('plan')
  if (typeof academyId !== 'string' || !academyId) return { ok: false, error: '학원 정보가 없습니다.' }
  // 실제 판매 요금제(무료/스타터/스탠다드/프리미엄)만 허용
  if (typeof plan !== 'string' || !isSelectablePlanType(plan)) {
    return { ok: false, error: '변경할 플랜을 다시 선택해주세요.' }
  }

  const limits = getPlanTypeLimits(plan)

  try {
    await prisma.academy.update({
      where: { id: academyId },
      data: {
        subscriptionPlan: plan,
        planType: plan,
        // 플랜에 맞춰 정원(교사/학생 한도)도 함께 적용
        maxStudents: limits.maxStudents,
        maxTeachers: limits.maxTeachers,
      },
    })

    await revalidateAcademySubscription(academyId)
    return { ok: true, message: `플랜이 ${PLAN_TYPE_LABEL[plan]}(으)로 변경되었습니다.` }
  } catch (e) {
    console.error('[changePlan]', e)
    return { ok: false, error: '플랜 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }
}

export async function suspendAcademy(formData: FormData): Promise<AcademyActionResult> {
  await requireAdmin()

  const academyId = formData.get('academyId')
  if (typeof academyId !== 'string' || !academyId) return { ok: false, error: '학원 정보가 없습니다.' }

  try {
    await prisma.academy.update({
      where: { id: academyId },
      data: { subscriptionStatus: 'CANCELLED' },
    })
    // 정지 즉시 학생 단어학습 접근이 막히도록 캐시 무효화
    await revalidateAcademySubscription(academyId)
    return { ok: true, message: '학원이 정지되었습니다.' }
  } catch (e) {
    console.error('[suspendAcademy]', e)
    return { ok: false, error: '학원 정지 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }
}

export async function deleteAcademy(
  formData: FormData,
): Promise<{ error: string } | void> {
  await requireAdmin()

  const academyId = formData.get('academyId') as string
  if (!academyId) return { error: '학원 ID가 없습니다.' }

  // Supabase Auth 삭제를 위해 학원 소속 사용자 ID 수집
  const academyUsers = await prisma.user.findMany({
    where: { academyId },
    select: { authId: true },
  })
  const authIds = academyUsers.map((u) => u.authId)

  try {
    // 외래키 의존 순서대로 전체 하드 삭제
    await prisma.$transaction([
      prisma.questionResponse.deleteMany({
        where: { session: { student: { user: { academyId } } } },
      }),
      prisma.testSession.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.skillAssessment.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.learningPath.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.teacherComment.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.report.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.attendance.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.badgeEarning.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      prisma.enrollment.deleteMany({ where: { academyId } }),
      prisma.student.deleteMany({ where: { user: { academyId } } }),
      prisma.notification.deleteMany({ where: { academyId } }),
      prisma.class.deleteMany({ where: { academyId } }),
      prisma.test.deleteMany({ where: { academyId } }),
      prisma.question.deleteMany({ where: { academyId } }),
      prisma.badge.deleteMany({ where: { academyId } }),
      prisma.subscription.deleteMany({ where: { academyId } }),
      prisma.academy.update({ where: { id: academyId }, data: { ownerId: null } }),
      prisma.user.deleteMany({ where: { academyId } }),
      prisma.academy.delete({ where: { id: academyId } }),
    ])
  } catch {
    return { error: '삭제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }

  // Supabase Auth 계정 삭제 — 다른 학원에도 가입된 교사·학생 계정은 유지
  await deleteOrphanAuthAccounts(authIds)

  redirect('/admin/academies')
}
