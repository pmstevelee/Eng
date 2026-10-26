'use server'

import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import { getCurrentUser } from '@/lib/auth'
import { deleteOrphanAuthAccounts } from '@/lib/account/multi-academy'
import { GRAMMAR_QUESTIONS_RANGE } from '@/lib/words/settings'
import { getOwnerAcademyIds } from '@/lib/branch'
import { MASTERY_REVIEW_STREAK_RANGE, PASS_SCORE_RANGE } from '@/lib/grammar/constants'
import { isValidPassScore, PASS_SCORE_STEP } from '@/lib/grammar/assignment-plan'

export async function withdrawAcademy(
  formData: FormData,
): Promise<{ error: string } | void> {
  const password = formData.get('password') as string
  if (!password) return { error: '비밀번호를 입력해주세요.' }

  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER') return { error: '권한이 없습니다.' }
  if (!user.academyId) return { error: '학원 정보를 찾을 수 없습니다.' }

  // 비밀번호 확인
  const supabase = await createClient()
  const { error: pwError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (pwError) return { error: '비밀번호가 올바르지 않습니다.' }

  const academyId = user.academyId

  // Supabase Auth 삭제를 위해 학원 소속 사용자 ID 수집
  const academyUsers = await prisma.user.findMany({
    where: { academyId },
    select: { authId: true },
  })
  const authIds = academyUsers.map((u) => u.authId)

  try {
    // 외래키 의존 순서대로 전체 삭제
    await prisma.$transaction([
      // 1. 문제 응답 (TestSession, Question 의존)
      prisma.questionResponse.deleteMany({
        where: { session: { student: { user: { academyId } } } },
      }),
      // 2. 테스트 세션 (Test, Student 의존)
      prisma.testSession.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 3. 스킬 평가
      prisma.skillAssessment.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 4. 학습 경로
      prisma.learningPath.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 5. 교사 코멘트
      prisma.teacherComment.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 6. 리포트
      prisma.report.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 7. 출석
      prisma.attendance.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 8. 배지 획득
      prisma.badgeEarning.deleteMany({
        where: { student: { user: { academyId } } },
      }),
      // 9. 수강 등록
      prisma.enrollment.deleteMany({ where: { academyId } }),
      // 10. 학생
      prisma.student.deleteMany({ where: { user: { academyId } } }),
      // 11. 알림
      prisma.notification.deleteMany({ where: { academyId } }),
      // 12. 반
      prisma.class.deleteMany({ where: { academyId } }),
      // 13. 테스트
      prisma.test.deleteMany({ where: { academyId } }),
      // 14. 문제 (학원 전용)
      prisma.question.deleteMany({ where: { academyId } }),
      // 15. 배지
      prisma.badge.deleteMany({ where: { academyId } }),
      // 16. 구독 이력
      prisma.subscription.deleteMany({ where: { academyId } }),
      // 17. ownerId FK 해제 후 사용자 삭제
      prisma.academy.update({ where: { id: academyId }, data: { ownerId: null } }),
      // 18. 학원 소속 전체 사용자 삭제
      prisma.user.deleteMany({ where: { academyId } }),
      // 19. 학원 삭제
      prisma.academy.delete({ where: { id: academyId } }),
    ])
  } catch {
    return { error: '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }

  // Supabase Auth 계정 삭제 — 다른 학원에도 가입된 교사·학생 계정은 유지
  await deleteOrphanAuthAccounts(authIds)

  redirect('/login')
}

export async function updateAcademyInfo(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const businessName = (formData.get('businessName') as string)?.trim()
  const address = (formData.get('address') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()

  if (!businessName) return { error: '상호명을 입력해주세요.' }

  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return { error: '권한이 없습니다.' }

  await prisma.academy.update({
    where: { id: user.academyId },
    data: {
      businessName: businessName || null,
      address: address || null,
      phone: phone || null,
    },
  })

  revalidateTag(`user-${user.id}`)
  revalidatePath('/owner/settings/academy')
  revalidatePath('/owner')
  await logActivity({
    userId: user.id,
    role: 'ACADEMY_OWNER',
    academyId: user.academyId,
    action: ACTIVITY_ACTIONS.ACADEMY_SETTINGS_UPDATE,
    metadata: { field: 'academy_info' },
  })
  return { success: true }
}

export async function updateNotificationSettings(settings: {
  newTeacherJoin: boolean
  newStudentJoin: boolean
  testCompleted: boolean
  subscriptionExpiring: boolean
  levelTestPeriod?: string
}): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return { error: '권한이 없습니다.' }

  const academy = await prisma.academy.findUnique({
    where: { id: user.academyId },
    select: { settingsJson: true },
  })

  const currentSettings =
    academy?.settingsJson && typeof academy.settingsJson === 'object'
      ? (academy.settingsJson as Record<string, unknown>)
      : {}

  await prisma.academy.update({
    where: { id: user.academyId },
    data: {
      settingsJson: {
        ...currentSettings,
        notifications: {
          newTeacherJoin: settings.newTeacherJoin,
          newStudentJoin: settings.newStudentJoin,
          testCompleted: settings.testCompleted,
          subscriptionExpiring: true, // 항상 ON
          levelTestPeriod: settings.levelTestPeriod ?? 'monthly',
        },
      },
    },
  })

  revalidatePath('/owner/settings/notifications')
  return { success: true }
}

export async function updateWordLearningSettings(settings: {
  dailyNewWords: number
  dailyGrammarQuestions: number
  globalRanking: boolean
}): Promise<{ error?: string; success?: boolean }> {
  if (!Number.isInteger(settings.dailyNewWords) || settings.dailyNewWords < 1 || settings.dailyNewWords > 100) {
    return { error: '하루 단어 수는 1~100 사이여야 합니다.' }
  }
  if (
    !Number.isInteger(settings.dailyGrammarQuestions) ||
    settings.dailyGrammarQuestions < GRAMMAR_QUESTIONS_RANGE.min ||
    settings.dailyGrammarQuestions > GRAMMAR_QUESTIONS_RANGE.max
  ) {
    return {
      error: `하루 문법 문제 수는 ${GRAMMAR_QUESTIONS_RANGE.min}~${GRAMMAR_QUESTIONS_RANGE.max} 사이여야 합니다.`,
    }
  }

  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return { error: '권한이 없습니다.' }

  const academy = await prisma.academy.findUnique({
    where: { id: user.academyId },
    select: { settingsJson: true },
  })

  const currentSettings =
    academy?.settingsJson && typeof academy.settingsJson === 'object'
      ? (academy.settingsJson as Record<string, unknown>)
      : {}
  const currentWordLearning =
    currentSettings.wordLearning && typeof currentSettings.wordLearning === 'object'
      ? (currentSettings.wordLearning as Record<string, unknown>)
      : {}

  await prisma.academy.update({
    where: { id: user.academyId },
    data: {
      settingsJson: {
        ...currentSettings,
        wordLearning: {
          ...currentWordLearning,
          dailyNewWords: settings.dailyNewWords,
          dailyGrammarQuestions: settings.dailyGrammarQuestions,
          globalRanking: settings.globalRanking,
        },
      },
    },
  })

  // 단어학습 설정은 구독 캐시(academy-{id})와 함께 읽히므로 즉시 반영되도록 무효화한다.
  // (오늘 이미 생성된 오늘의 단어학습은 그대로, 다음 날 생성분부터 적용)
  revalidateTag(`academy-${user.academyId}`)
  revalidateTag('ranking-optout')
  revalidatePath('/owner/settings/word-learning')
  return { success: true }
}

/**
 * 학원 문법학습 설정 (settingsJson.grammarLearning) — 통과 기준·숙달 복습 횟수.
 * 지점 학생도 같은 기준을 쓰도록 본원과 소유 지점 모두에 저장한다.
 * 이미 통과·숙달한 기록은 다시 판정하지 않는다 (다음 확인 테스트·복습부터 적용).
 */
export async function updateGrammarLearningSettings(settings: {
  passScore: number
  masteryReviewStreak: number
}): Promise<{ error?: string; success?: boolean }> {
  if (!isValidPassScore(settings?.passScore, PASS_SCORE_RANGE)) {
    return { error: `통과 기준은 ${PASS_SCORE_RANGE.min}~${PASS_SCORE_RANGE.max}% 사이, ${PASS_SCORE_STEP}% 단위로 정해 주세요.` }
  }
  const streak = settings.masteryReviewStreak
  if (!Number.isInteger(streak) || streak < MASTERY_REVIEW_STREAK_RANGE.min || streak > MASTERY_REVIEW_STREAK_RANGE.max) {
    return { error: `숙달 복습 횟수는 ${MASTERY_REVIEW_STREAK_RANGE.min}~${MASTERY_REVIEW_STREAK_RANGE.max}회 사이여야 합니다.` }
  }

  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return { error: '권한이 없습니다.' }

  const ownerIds = await getOwnerAcademyIds(user.id)
  const academyIds = Array.from(new Set([user.academyId, ...ownerIds]))
  const academies = await prisma.academy.findMany({
    where: { id: { in: academyIds } },
    select: { id: true, settingsJson: true },
  })

  await prisma.$transaction(
    academies.map((academy) => {
      const current =
        academy.settingsJson && typeof academy.settingsJson === 'object' && !Array.isArray(academy.settingsJson)
          ? (academy.settingsJson as Record<string, unknown>)
          : {}
      const currentGrammar =
        current.grammarLearning && typeof current.grammarLearning === 'object'
          ? (current.grammarLearning as Record<string, unknown>)
          : {}
      return prisma.academy.update({
        where: { id: academy.id },
        data: {
          settingsJson: {
            ...current,
            grammarLearning: { ...currentGrammar, passScore: settings.passScore, masteryReviewStreak: streak },
          },
        },
      })
    }),
  )

  await logActivity({
    userId: user.id,
    role: user.role,
    academyId: user.academyId,
    action: ACTIVITY_ACTIONS.GRAMMAR_SETTINGS_UPDATE,
    metadata: { passScore: settings.passScore, masteryReviewStreak: streak, academyCount: academies.length },
  })
  for (const academy of academies) revalidateTag(`academy-${academy.id}`)
  revalidatePath('/owner/settings/grammar-learning')
  return { success: true }
}

export async function sendPasswordResetEmail(): Promise<{ error?: string; success?: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { error: '인증이 필요합니다.' }

  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') ?? 'http'
  const redirectTo = `${protocol}://${host}/auth/callback?next=/reset-password`

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo,
  })
  if (error) {
    const isRateLimit =
      error.status === 429 ||
      error.code === 'over_email_send_rate_limit' ||
      /rate limit|security purposes/i.test(error.message)
    return {
      error: isRateLimit
        ? '요청이 너무 잦습니다. 잠시(약 1분) 후 다시 시도해주세요.'
        : '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
    }
  }

  return { success: true }
}

export async function regenerateInviteCode(): Promise<{ error?: string; code?: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return { error: '권한이 없습니다.' }

  const newCode = randomBytes(4).toString('hex').toUpperCase()

  const academy = await prisma.academy.update({
    where: { id: user.academyId },
    data: { inviteCode: newCode },
    select: { inviteCode: true },
  })

  revalidatePath('/owner/settings')
  return { code: academy.inviteCode }
}
