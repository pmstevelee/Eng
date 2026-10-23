import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { ChevronRight, Wallet } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { requireStudent } from '@/lib/auth-student'
import { hasOfficialLevelAssessment } from '@/lib/students/level-test-history'
import { getAcademyDailyNewWords } from '@/lib/words/access-guard'
import { resolveDailyNewWords } from '@/lib/words/settings'
import { parseStudentPaidFeatures } from '@/lib/student-credits/constants'
import { getStudentFlashcardQuota } from '@/lib/student-credits/wallet'
import { DailyLimitSetting } from '@/components/words/daily-limit-setting'
import { WithdrawModal } from './_components/withdraw-modal'
import { LearningProfileForm } from './_components/learning-profile-form'

const getCachedSettingsUser = (userId: string) =>
  unstable_cache(
    () =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          phone: true,
          academy: { select: { name: true, businessName: true, settingsJson: true } },
          student: { select: { grade: true, currentLevel: true, dailyNewWordsOverride: true } },
        },
      }),
    ['student-settings-user', userId],
    { revalidate: 300, tags: [`user-${userId}`] },
  )()

export default async function StudentSettingsPage() {
  const { userId, studentId, user: currentUser } = await requireStudent()
  const [user, levelLocked] = await Promise.all([
    getCachedSettingsUser(userId),
    hasOfficialLevelAssessment(studentId),
  ])
  const isMultiAcademy = currentUser.academies.length > 1
  if (!user) return null

  const academyDailyNewWords = getAcademyDailyNewWords(user.academy?.settingsJson)
  // 학생 결제 허용 학원만 크레딧 영역 노출
  const creditEnabled = parseStudentPaidFeatures(user.academy?.settingsJson).aiFlashcard
  const quota = creditEnabled ? await getStudentFlashcardQuota(studentId) : null
  const academyName = user.academy?.businessName ?? user.academy?.name ?? '-'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-sm text-gray-500 mt-1">계정 설정을 관리합니다</p>
      </div>

      {/* 계정 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">계정 정보</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-gray-500">이름</dt>
            <dd className="text-sm font-medium text-gray-900 mt-0.5">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">이메일</dt>
            <dd className="text-sm text-gray-700 mt-0.5">{user.email}</dd>
          </div>
          {user.phone && (
            <div>
              <dt className="text-xs text-gray-500">연락처</dt>
              <dd className="text-sm text-gray-700 mt-0.5">{user.phone}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-gray-500">소속 학원</dt>
            <dd className="text-sm text-gray-700 mt-0.5">{academyName}</dd>
          </div>
        </dl>
      </div>

      {/* 학년·학습레벨 */}
      {user.student && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">학년 · 학습레벨</h2>
          <LearningProfileForm
            initialGrade={user.student.grade}
            initialLevel={user.student.currentLevel}
            levelLocked={levelLocked}
          />
        </div>
      )}

      {/* 단어학습 */}
      {user.student && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">단어학습</h2>
          <DailyLimitSetting
            current={resolveDailyNewWords(academyDailyNewWords, user.student.dailyNewWordsOverride)}
            academyDefault={academyDailyNewWords}
            isCustom={user.student.dailyNewWordsOverride !== null}
          />
        </div>
      )}

      {/* 내 크레딧 (학생 결제 허용 학원) */}
      {quota && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">내 크레딧</h2>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {quota.creditBalance.toLocaleString('ko-KR')}
                <span className="ml-1 text-sm font-medium text-gray-500">크레딧</span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                AI 플래시카드 이번 달 무료 {quota.remainingFree}/{quota.freeLimit}단어 남음
              </p>
            </div>
            <Link
              href="/student/credits"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:border-gray-300"
            >
              <Wallet className="h-4 w-4" />
              충전 · 내역 보기
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
          </div>
        </div>
      )}

      {/* 계정 탈퇴 */}
      <div className="bg-accent-red-light border border-accent-red rounded-xl p-6">
        <h2 className="text-base font-semibold text-accent-red mb-2">계정 탈퇴</h2>
        <p className="text-sm text-gray-700 mb-4">
          계정을 탈퇴하면 내 모든 학습 기록, 성적, 배지 등 관련 데이터가 영구적으로 삭제됩니다.
          이 작업은 되돌릴 수 없습니다.
        </p>
        {isMultiAcademy && (
          <p className="text-sm text-gray-700 mb-4">
            여러 학원에 가입된 계정이므로 <strong>{academyName}</strong>의 데이터만 삭제되며,
            다른 학원은 같은 이메일로 계속 이용할 수 있습니다.
          </p>
        )}
        <WithdrawModal />
      </div>
    </div>
  )
}
