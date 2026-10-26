'use client'

// 학원 전용 "문제 AI 생성" 확인 창 — 차감 크레딧·현재 잔액 표시 → 10문항 생성(검수 대기)

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Coins, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateAcademyGrammarQuestions } from '@/lib/grammar/manage-actions'
import { ManageDialog } from './manage-dialog'
import type { GrammarManageRole } from './manage-nav'

export interface AiTarget {
  pointId: string
  pointTitle: string
}

interface Props {
  role: GrammarManageRole
  classId: string
  target: AiTarget | null
  credit: { balance: number; perGeneration: number }
  questionsHref: string
  onClose: () => void
  onDone: (m: string) => void
}

export function AiQuestionDialog({ role, classId, target, credit, questionsHref, onClose, onDone }: Props) {
  const [error, setError] = useState<{ text: string; noCredit: boolean } | null>(null)
  const [pending, startTransition] = useTransition()
  const enough = credit.balance >= credit.perGeneration
  const showCharge = !enough || error?.noCredit

  const close = () => {
    setError(null)
    onClose()
  }

  const submit = () => {
    if (!target) return
    setError(null)
    startTransition(async () => {
      const res = await generateAcademyGrammarQuestions(classId, target.pointId)
      if (!res.ok) return setError({ text: res.error, noCredit: res.code === 'NO_CREDIT' })
      onDone(`'${target.pointTitle}' 문제 ${res.saved}개를 만들었어요. 검수 대기에서 확인 후 검수 완료해야 학생에게 출제돼요.`)
      close()
    })
  }

  return (
    <ManageDialog open={target !== null} onClose={close} busy={pending} title="우리 학원 문제 AI 생성" description={target?.pointTitle} className="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          이 포인트의 개념 정리를 바탕으로 문제 10개를 만들어 우리 학원 전용으로 저장합니다. 만든 문제는{' '}
          <Link href={questionsHref} className="font-medium text-[#1865F2] underline-offset-2 hover:underline">
            검수 대기
          </Link>
          에서 확인하고 검수 완료해야 학생에게 출제돼요.
        </p>

        <dl className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <dt className="text-xs text-gray-500">차감 크레딧</dt>
            <dd className="mt-0.5 text-lg font-semibold text-gray-900">{credit.perGeneration.toLocaleString()}</dd>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2.5">
            <dt className="text-xs text-gray-500">현재 잔액</dt>
            <dd className={`mt-0.5 text-lg font-semibold ${enough ? 'text-gray-900' : 'text-[#D92916]'}`}>
              {credit.balance.toLocaleString()}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-gray-500">AI가 문제를 만들지 못하면 크레딧은 차감되지 않아요. 만드는 데 30초~1분 걸립니다.</p>

        {error && <p className="text-sm text-[#D92916]">{error.text}</p>}
        {showCharge && (
          <p className="flex items-center gap-2 rounded-lg bg-[#FFF4D6] px-3 py-2.5 text-sm text-[#7A5300]">
            <Coins className="h-4 w-4 shrink-0" aria-hidden />
            {role === 'ACADEMY_OWNER' ? (
              <span>
                크레딧이 부족합니다.{' '}
                <Link href="/owner/credits" className="font-semibold underline underline-offset-2">
                  크레딧 충전하기
                </Link>
              </span>
            ) : (
              <span>크레딧이 부족합니다. 학원장님께 크레딧 충전을 요청해 주세요.</span>
            )}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={close} disabled={pending}>
            취소
          </Button>
          <Button type="button" className="min-h-[44px]" onClick={submit} disabled={pending || !enough}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            {pending ? '만드는 중…' : '10문제 만들기'}
          </Button>
        </div>
      </div>
    </ManageDialog>
  )
}
