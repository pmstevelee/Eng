'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { NotebookPen } from 'lucide-react'
import { createConsultation, updateConsultation } from '@/lib/consultation/actions'
import {
  CONSULTATION_TYPE_LABEL,
  kstLocalInputToIso,
  nowKstLocalInput,
  toKstLocalInput,
  type ConsultationTypeValue,
} from '@/lib/consultation/constants'
import { Field, FormActions, FormError, ModalShell, inputClass, textareaClass } from './modal-shell'

export type ConsultationFormInitial = {
  id: string
  consultedAt: string
  type: ConsultationTypeValue
  learningHistory: string | null
  prevAcademy: string | null
  goal: string | null
  parentNeeds: string | null
  memo: string | null
}

type Props = {
  leadId: string
  /** 첫 상담 기록이면 기본 유형을 '신규 상담'으로 */
  hasConsultations: boolean
  initial?: ConsultationFormInitial
  onClose: () => void
}

const GOAL_PRESETS = ['내신', '수능', '회화', '영어 기초', '특목·국제중', '어학 시험']

export function ConsultationFormDialog(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const init = props.initial
  const [form, setForm] = useState({
    consultedAt: init ? toKstLocalInput(init.consultedAt) : nowKstLocalInput(),
    type: (init?.type ?? (props.hasConsultations ? 'FOLLOW_UP' : 'INITIAL')) as ConsultationTypeValue,
    learningHistory: init?.learningHistory ?? '',
    prevAcademy: init?.prevAcademy ?? '',
    goal: init?.goal ?? '',
    parentNeeds: init?.parentNeeds ?? '',
    memo: init?.memo ?? '',
  })
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const addGoal = (g: string) => {
    const parts = form.goal.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.includes(g)) return
    set('goal', [...parts, g].join(', '))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.consultedAt) {
      setError('상담 일시를 입력해주세요.')
      return
    }
    startTransition(async () => {
      const payload = { ...form, consultedAt: kstLocalInputToIso(form.consultedAt) }
      const result = init
        ? await updateConsultation(init.id, payload)
        : await createConsultation(props.leadId, payload)
      if (result.error) {
        setError(result.error)
        return
      }
      props.onClose()
      router.refresh()
    })
  }

  return (
    <ModalShell title={init ? '상담 기록 수정' : '상담 기록 추가'} icon={NotebookPen} onClose={props.onClose} size="lg">
      <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="상담 일시" required>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.consultedAt}
              onChange={(e) => set('consultedAt', e.target.value)}
              required
            />
          </Field>
          <Field label="상담 유형" required>
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => set('type', e.target.value as ConsultationTypeValue)}
            >
              {(Object.keys(CONSULTATION_TYPE_LABEL) as ConsultationTypeValue[]).map((t) => (
                <option key={t} value={t}>
                  {CONSULTATION_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="영어 학습 이력">
          <textarea
            className={textareaClass}
            value={form.learningHistory}
            onChange={(e) => set('learningHistory', e.target.value)}
            placeholder="예: 초3부터 영어 유치원 출신, 파닉스 완료, 리딩 AR 2점대"
            maxLength={2000}
          />
        </Field>
        <Field label="타 학원 경험">
          <textarea
            className={textareaClass}
            value={form.prevAcademy}
            onChange={(e) => set('prevAcademy', e.target.value)}
            placeholder="예: OO어학원 1년 수강, 숙제량 부담으로 그만둠"
            maxLength={2000}
          />
        </Field>
        <Field label="목표">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {GOAL_PRESETS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => addGoal(g)}
                className="h-9 px-3 rounded-full border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + {g}
              </button>
            ))}
          </div>
          <input
            className={inputClass}
            value={form.goal}
            onChange={(e) => set('goal', e.target.value)}
            placeholder="예: 중등 내신 대비"
            maxLength={2000}
          />
        </Field>
        <Field label="학부모 요구사항·고민">
          <textarea
            className={textareaClass}
            value={form.parentNeeds}
            onChange={(e) => set('parentNeeds', e.target.value)}
            placeholder="예: 문법이 약함, 주 3회 이하 희망, 소수 정예반 선호"
            maxLength={2000}
          />
        </Field>
        <Field label="메모">
          <textarea
            className={textareaClass}
            value={form.memo}
            onChange={(e) => set('memo', e.target.value)}
            placeholder="자유 메모"
            maxLength={5000}
          />
        </Field>

        {!init && (
          <p className="text-xs text-gray-500">&lsquo;문의&rsquo;·&lsquo;상담예약&rsquo; 상태에서 기록을 추가하면 자동으로 &lsquo;상담완료&rsquo;로 바뀝니다.</p>
        )}
        <FormError message={error} />
        <FormActions onCancel={props.onClose} pending={isPending} submitLabel="저장" pendingLabel="저장 중..." />
      </form>
    </ModalShell>
  )
}
