'use client'

// ① 코스 불러오기 — 템플릿 선택 → 시작일·단원 간격 → 마감일 자동 계산 → 반 배정으로 복사

import { useMemo, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ASSIGN_INTERVAL_RANGE, isValidDateKey, scheduleCourseDates } from '@/lib/grammar/assignment-plan'
import { importCourseToClass } from '@/lib/grammar/manage-actions'
import type { CourseTemplateOption } from '@/lib/grammar/manage-queries'
import { cn } from '@/lib/utils'
import { ManageDialog } from './manage-dialog'
import { formatDateKey } from './format'

interface Props {
  open: boolean
  onClose: () => void
  classId: string
  templates: CourseTemplateOption[]
  todayKey: string
  onDone: (message: string) => void
}

export function CourseImportDialog({ open, onClose, classId, templates, todayKey, onDone }: Props) {
  const [courseId, setCourseId] = useState<string>('')
  const [startDate, setStartDate] = useState(todayKey)
  const [interval, setInterval] = useState('7')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const course = templates.find((t) => t.id === courseId) ?? null
  const intervalNum = Number(interval)
  const intervalOk =
    Number.isInteger(intervalNum) && intervalNum >= ASSIGN_INTERVAL_RANGE.min && intervalNum <= ASSIGN_INTERVAL_RANGE.max
  const preview = useMemo(() => {
    if (!course || course.itemCount === 0 || !isValidDateKey(startDate) || !intervalOk) return null
    const dates = scheduleCourseDates(startDate, intervalNum, course.itemCount)
    return { first: dates[0].dueKey, last: dates[dates.length - 1].dueKey }
  }, [course, startDate, intervalOk, intervalNum])

  const submit = () => {
    setError(null)
    if (!course) return setError('불러올 코스를 골라 주세요.')
    if (!isValidDateKey(startDate)) return setError('시작일을 입력해 주세요.')
    if (!intervalOk) return setError(`단원 간격은 ${ASSIGN_INTERVAL_RANGE.min}~${ASSIGN_INTERVAL_RANGE.max}일 사이로 입력해 주세요.`)
    startTransition(async () => {
      const res = await importCourseToClass(classId, { courseId: course.id, startDate, intervalDays: intervalNum })
      if (!res.ok) return setError(res.error)
      const parts = [`'${course.name}'에서 ${res.added}개 단원을 배정했어요.`]
      if (res.skippedDuplicate > 0) parts.push(`이미 배정된 ${res.skippedDuplicate}개는 건너뛰었어요.`)
      if (res.skippedHidden > 0) parts.push(`아직 공개되지 않은 ${res.skippedHidden}개는 빠졌어요.`)
      onDone(parts.join(' '))
      onClose()
    })
  }

  const groups: { label: string; items: CourseTemplateOption[] }[] = [
    { label: '우리 학원 코스', items: templates.filter((t) => t.scope === 'ACADEMY') },
    { label: '본사 기본 코스', items: templates.filter((t) => t.scope === 'HQ') },
  ].filter((g) => g.items.length > 0)

  return (
    <ManageDialog
      open={open}
      onClose={onClose}
      busy={pending}
      title="코스 불러오기"
      description="코스의 단원 순서대로 배정 목록 끝에 붙입니다. 나중에 코스를 고쳐도 이 반 배정은 바뀌지 않아요."
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">코스</legend>
          {groups.length === 0 && <p className="text-sm text-gray-500">불러올 수 있는 코스가 없습니다.</p>}
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="mb-1 text-xs font-medium text-gray-500">{g.label}</p>
                <div className="space-y-1.5">
                  {g.items.map((t) => (
                    <label
                      key={t.id}
                      className={cn(
                        'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2',
                        courseId === t.id ? 'border-[#1865F2] bg-[#EFF4FF]' : 'border-gray-200 hover:bg-gray-50',
                      )}
                    >
                      <input
                        type="radio"
                        name="course"
                        className="h-4 w-4 accent-[#1865F2]"
                        checked={courseId === t.id}
                        onChange={() => {
                          setError(null)
                          setCourseId(t.id)
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900">{t.name}</span>
                        {t.description && <span className="block truncate text-xs text-gray-500">{t.description}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">{t.itemCount}개 단원</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="import-start">시작일</Label>
            <Input
              id="import-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setError(null)
                setStartDate(e.target.value)
              }}
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div>
            <Label htmlFor="import-interval">단원 간격(일)</Label>
            <Input
              id="import-interval"
              type="number"
              inputMode="numeric"
              min={ASSIGN_INTERVAL_RANGE.min}
              max={ASSIGN_INTERVAL_RANGE.max}
              value={interval}
              onChange={(e) => {
                setError(null)
                setInterval(e.target.value)
              }}
              className="mt-1 min-h-[44px]"
            />
          </div>
        </div>

        <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
          {preview
            ? `${course?.itemCount}개 단원 · 첫 마감 ${formatDateKey(preview.first)} · 마지막 마감 ${formatDateKey(preview.last)}. 모든 단원은 시작일부터 학생에게 보이고, ${intervalNum}일마다 한 단원씩 마감돼요.`
            : '코스와 날짜를 정하면 마감일이 자동으로 계산돼요.'}
        </p>

        {error && <p className="text-sm text-[#D92916]">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="button" className="min-h-[44px]" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            불러오기
          </Button>
        </div>
      </div>
    </ManageDialog>
  )
}
