import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireStudent } from '@/lib/auth-student'
import { isStudentAiFlashcardEnabled } from '@/lib/student-credits/wallet'
import { getAiFlashcardQuota } from '@/lib/words/ai-flashcard-actions'
import { AiFlashcardBuilder } from '@/components/words/ai-flashcard-builder'

// AI 생성(최대 100단어, 병렬 요청)이 서버 액션 기본 시간보다 오래 걸릴 수 있다
export const maxDuration = 60

export default async function StudentAiFlashcardPage() {
  const { user } = await requireStudent()
  // 학생 결제 허용 학원(위고업잉글리시)만
  if (!(await isStudentAiFlashcardEnabled(user.academyId))) redirect('/student/words')

  const quota = await getAiFlashcardQuota()
  if (!quota) redirect('/student/words')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/student/words" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800">
        <ChevronLeft className="h-4 w-4" />
        단어학습
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 플래시카드 만들기</h1>
        <p className="mt-1 text-sm text-gray-500">
          외우고 싶은 단어를 적거나 텍스트 파일로 올리면 AI가 뜻·영영풀이·예문을 채워 나만의 플래시카드를 만들어 줍니다.
        </p>
      </div>
      <AiFlashcardBuilder classes={[]} initialQuota={quota} basePath="/student/words" mode="student" />
    </div>
  )
}
