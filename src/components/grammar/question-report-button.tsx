'use client'

// 문제 오류 신고 버튼 + 신고 창 — 기존 report-actions.ts(reportQuestion)를 그대로 쓴다

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { reportQuestion } from '@/lib/questions/report-actions'
import type { QuestionReportType } from '@/generated/prisma'

const REPORT_TYPES: { value: QuestionReportType; label: string }[] = [
  { value: 'WRONG_ANSWER', label: '정답 오류' },
  { value: 'TYPO', label: '오탈자' },
  { value: 'UNCLEAR', label: '문제 불명확' },
  { value: 'OTHER', label: '기타' },
]

export function QuestionReportButton({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<QuestionReportType>('WRONG_ANSWER')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function openModal() {
    setOpen(true)
    setDone(false)
    setError('')
    setDescription('')
    setType('WRONG_ANSWER')
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const res = await reportQuestion({ questionId, reportType: type, description })
      if (res.error) setError(res.error)
      else setDone(true)
    } catch {
      setError('신고하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-xs text-gray-500 transition-colors hover:border-orange-300 hover:text-orange-500"
      >
        <Flag className="h-3 w-3" />
        오류 신고
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm">
            {done ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F7EE]">
                  <Flag className="h-6 w-6 text-[#1FAF54]" />
                </div>
                <h3 className="text-base font-bold text-gray-900">신고가 접수되었어요</h3>
                <p className="mt-1 text-sm text-gray-500">검토 후 고칠게요. 알려 줘서 고마워요.</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-6 h-11 w-full rounded-lg bg-[#1865F2] text-sm font-semibold text-white"
                >
                  닫기
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-gray-900">문제 오류 신고</h3>
                <p className="mt-1 text-xs text-gray-500">오류 유형을 고르고 내용을 적어 주세요.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {REPORT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`min-h-[44px] rounded-lg border px-3 text-sm font-medium ${
                        type === t.value
                          ? 'border-orange-400 bg-orange-50 text-orange-600'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="어떤 점이 이상한지 적어 주세요. (선택)"
                  rows={3}
                  maxLength={500}
                  className="mt-3 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
                />
                {error && <p className="mt-2 text-xs text-[#D92916]">{error}</p>}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="h-11 flex-1 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="h-11 flex-1 rounded-lg bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                  >
                    {submitting ? '신고 중...' : '신고하기'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
