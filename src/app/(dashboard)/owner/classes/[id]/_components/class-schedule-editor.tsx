'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { saveClassSchedules } from '@/lib/attendance/actions'
import {
  DAY_OF_WEEK_LABEL,
  DAY_OF_WEEK_ORDER,
  validateScheduleRow,
  type ClassScheduleRow,
} from '@/lib/attendance/constants'
import { cn } from '@/lib/utils'

type EditableRow = ClassScheduleRow & { key: number }

const fieldClass =
  'h-11 px-3 rounded-xl border text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent'

export function ClassScheduleEditor({
  classId,
  initialRows,
  prefilledFromLegacy,
}: {
  classId: string
  initialRows: ClassScheduleRow[]
  /** 저장된 시간표가 없어 기존 반 정보(scheduleJson)에서 불러온 경우 */
  prefilledFromLegacy: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState<EditableRow[]>(() => initialRows.map((r, i) => ({ ...r, key: i })))
  const [nextKey, setNextKey] = useState(initialRows.length)
  const [dirty, setDirty] = useState(prefilledFromLegacy)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const errors = rows.map((r) => validateScheduleRow(r))
  const hasError = errors.some(Boolean)

  const update = (key: number, patch: Partial<ClassScheduleRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    setDirty(true)
    setMessage(null)
  }

  const addRow = () => {
    // 직전 행의 시간을 이어받아 입력을 줄인다
    const last = rows[rows.length - 1]
    setRows((prev) => [
      ...prev,
      { key: nextKey, dayOfWeek: 1, startTime: last?.startTime ?? '16:00', endTime: last?.endTime ?? '17:30' },
    ])
    setNextKey((k) => k + 1)
    setDirty(true)
    setMessage(null)
  }

  const removeRow = (key: number) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
    setDirty(true)
    setMessage(null)
  }

  const save = () => {
    if (hasError) return
    startTransition(async () => {
      const result = await saveClassSchedules(
        classId,
        rows.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
      )
      if (result.error) {
        setMessage({ ok: false, text: result.error })
        return
      }
      setDirty(false)
      setMessage({ ok: true, text: '시간표를 저장했습니다.' })
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">정기 시간표</h3>
        <p className="text-xs text-gray-500 mt-0.5">요일별 수업 시간을 등록하면 출결관리에서 수업으로 사용됩니다.</p>
      </div>

      <div className="p-5 space-y-3">
        {prefilledFromLegacy && dirty && (
          <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            반 정보에 입력된 수업 요일·시간을 불러왔습니다. 확인 후 저장해주세요.
          </p>
        )}

        {rows.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">등록된 시간표가 없습니다.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row, i) => (
              <li key={row.key}>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={row.dayOfWeek}
                    onChange={(e) => update(row.key, { dayOfWeek: Number(e.target.value) })}
                    aria-label="요일"
                    className={cn(fieldClass, 'w-24 border-gray-200')}
                  >
                    {DAY_OF_WEEK_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {DAY_OF_WEEK_LABEL[d]}요일
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => update(row.key, { startTime: e.target.value })}
                    aria-label="시작 시각"
                    className={cn(fieldClass, 'w-32', errors[i] ? 'border-accent-red' : 'border-gray-200')}
                  />
                  <span className="text-sm text-gray-500">~</span>
                  <input
                    type="time"
                    value={row.endTime}
                    onChange={(e) => update(row.key, { endTime: e.target.value })}
                    aria-label="종료 시각"
                    aria-invalid={!!errors[i]}
                    className={cn(fieldClass, 'w-32', errors[i] ? 'border-accent-red' : 'border-gray-200')}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label="시간 삭제"
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-accent-red transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {errors[i] && <p className="text-xs text-accent-red mt-1">{errors[i]}</p>}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={addRow}
          className="h-11 px-4 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-primary-700 inline-flex items-center gap-1.5 hover:bg-gray-50"
        >
          <Plus size={16} />
          시간 추가
        </button>
      </div>

      <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
        {message && (
          <p role="status" className={cn('text-sm', message.ok ? 'text-accent-green' : 'text-accent-red')}>
            {message.text}
          </p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={pending || hasError || !dirty}
          className="h-11 px-5 rounded-xl bg-primary-700 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
        >
          {pending && <Loader2 size={16} className="animate-spin" />}
          저장
        </button>
      </div>
    </div>
  )
}
