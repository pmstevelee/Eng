'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PersonalEvent,
  EVENT_TYPE_LABELS,
  REPEAT_LABELS,
} from './types'

type Props = {
  open: boolean
  onClose: () => void
  onAdd: (event: PersonalEvent) => void
  defaultDate?: string // "YYYY-MM-DD"
}

const TYPES = (['CLASS', 'TEST', 'MEETING', 'OTHER'] as const)
const REPEATS = (['NONE', 'WEEKLY', 'MONTHLY'] as const)

function todayStr(): string {
  const d = new Date()
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  )
}

export function AddEventDialog({ open, onClose, onAdd, defaultDate }: Props) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate ?? todayStr())
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [memo, setMemo] = useState('')
  const [type, setType] = useState<PersonalEvent['type']>('OTHER')
  const [repeat, setRepeat] = useState<PersonalEvent['repeat']>('NONE')

  // defaultDate가 바뀔 때마다 날짜 필드 업데이트
  useEffect(() => {
    if (defaultDate) setDate(defaultDate)
  }, [defaultDate])

  // 닫힐 때 초기화
  useEffect(() => {
    if (!open) {
      setTitle('')
      setDate(defaultDate ?? todayStr())
      setStartTime('')
      setEndTime('')
      setMemo('')
      setType('OTHER')
      setRepeat('NONE')
    }
  }, [open, defaultDate])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    onAdd({
      id: crypto.randomUUID(),
      title: title.trim(),
      date,
      startTime,
      endTime,
      memo: memo.trim(),
      type,
      repeat,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-gray-200 bg-white shadow-sm max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">일정 추가</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {/* 제목 */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              제목 <span className="text-accent-red">*</span>
            </Label>
            <Input
              placeholder="일정 제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11"
              required
            />
          </div>

          {/* 유형 */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">유형</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    type === t
                      ? 'border-primary-700 bg-primary-100 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {EVENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* 날짜 + 반복 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                날짜 <span className="text-accent-red">*</span>
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">반복</Label>
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as PersonalEvent['repeat'])}
                className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
              >
                {REPEATS.map((r) => (
                  <option key={r} value={r}>{REPEAT_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">시작 시간</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">종료 시간</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          {/* 메모 */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">메모</Label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="추가 메모 (선택)"
              rows={2}
              className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-700"
            />
          </div>

          {/* 반복 안내 */}
          {repeat !== 'NONE' && (
            <p className="rounded-lg bg-primary-100 px-3 py-2 text-xs text-primary-700">
              {repeat === 'WEEKLY'
                ? `매주 ${new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', { weekday: 'long' })}에 반복됩니다`
                : `매월 ${new Date(date + 'T00:00:00').getDate()}일에 반복됩니다`}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11 bg-primary-700 text-white hover:bg-primary-800"
              disabled={!title.trim()}
            >
              추가
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
