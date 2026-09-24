'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, UserRound } from 'lucide-react'
import {
  AdaptiveTestClient,
  type AdaptiveRunner,
} from '@/app/(dashboard)/student/tests/[sessionId]/_components/adaptive-test-client'
import { startPlacementTest, submitPlacementAnswer, submitPlacementWriting } from '@/lib/placement/actions'

type Props = {
  token: string
  inviteId: string
  studentName: string
  academyName: string
  /** 이미 시작한 응시 (새로고침·재접속) */
  started: boolean
}

type Step = 'confirm' | 'not_me' | 'test' | 'done'

export function PlacementTestShell({ token, inviteId, studentName, academyName, started }: Props) {
  const [step, setStep] = useState<Step>(started ? 'test' : 'confirm')

  const runner = useMemo<AdaptiveRunner>(
    () => ({
      start: () => startPlacementTest(token),
      submitAnswer: (questionId, answer) => submitPlacementAnswer(token, questionId, answer),
      submitWriting: (questionIndex, answer) => submitPlacementWriting(token, questionIndex, answer),
      onComplete: () => setStep('done'),
    }),
    [token],
  )

  if (step === 'test') {
    return (
      <AdaptiveTestClient
        sessionId={inviteId}
        studentName={studentName}
        testTitle={`${academyName} 영어 레벨테스트`}
        runner={runner}
      />
    )
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <p className="text-center text-sm font-semibold text-gray-500 mb-6">{academyName}</p>

      {step === 'done' ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-accent-green-light flex items-center justify-center">
            <CheckCircle2 size={28} className="text-accent-green" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">응시를 완료했습니다</h1>
          <p className="text-sm text-gray-500">
            수고했어요, {studentName} 학생!
            <br />
            결과는 학원에서 확인한 뒤 학부모님께 안내드립니다.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
              <UserRound size={26} className="text-primary-700" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">응시자 확인</h1>
            {step === 'confirm' ? (
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">{studentName}</span> 학생 본인이 맞나요?
              </p>
            ) : (
              <p className="text-sm text-gray-700">
                이 링크는 <span className="font-semibold text-gray-900">{studentName}</span> 학생의 응시 링크입니다.
                <br />
                다른 학생이라면 학원으로 문의해 새 링크를 받아주세요.
              </p>
            )}
          </div>
          {step === 'confirm' ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setStep('test')}
                className="w-full min-h-12 rounded-xl bg-primary-700 text-white text-base font-semibold hover:bg-primary-800"
              >
                네, 맞습니다
              </button>
              <button
                type="button"
                onClick={() => setStep('not_me')}
                className="w-full min-h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                아니요
              </button>
              <p className="text-xs text-gray-500 text-center pt-1">
                약 30~40분 소요 · 한 번만 응시할 수 있습니다 · 중간에 창을 닫아도 이어서 응시할 수 있어요
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setStep('confirm')}
              className="w-full min-h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              돌아가기
            </button>
          )}
        </div>
      )}
    </main>
  )
}
