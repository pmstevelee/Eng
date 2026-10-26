'use client'

// 코스 템플릿 편집(학원장) — 이름·설명·포인트 순서. 본사 코스는 보기만 하고 복제해서 고친다.

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Copy, Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GrammarTreeCategory } from '@/lib/grammar/curriculum'
import { duplicateCourseTemplate, saveCourseTemplate } from '@/lib/grammar/manage-actions'
import type { CourseTemplateDetail } from '@/lib/grammar/manage-queries'
import { cn } from '@/lib/utils'
import { ManageDialog } from './manage-dialog'
import { PointPicker } from './point-picker'

type EditorPoint = CourseTemplateDetail['points'][number]

interface Props {
  basePath: string
  course: CourseTemplateDetail | null
  tree: GrammarTreeCategory[]
}

export function CourseEditor({ basePath, course, tree }: Props) {
  const router = useRouter()
  const readOnly = course?.scope === 'HQ'
  const [name, setName] = useState(course?.name ?? '')
  const [description, setDescription] = useState(course?.description ?? '')
  const [points, setPoints] = useState<EditorPoint[]>(course?.points ?? [])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const pointById = useMemo(() => {
    const map = new Map<string, EditorPoint>()
    for (const c of tree)
      for (const s of c.children)
        for (const p of s.points)
          map.set(p.id, { id: p.id, code: p.code, title: p.title, categoryLabel: `${c.name} › ${s.name}`, published: true })
    return map
  }, [tree])
  const inCourse = useMemo(() => new Set(points.map((p) => p.id)), [points])

  const changed = () => {
    setSaved(false)
    setError(null)
  }
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= points.length) return
    const next = [...points]
    ;[next[i], next[j]] = [next[j], next[i]]
    setPoints(next)
    changed()
  }

  const save = () => {
    setError(null)
    if (!name.trim()) return setError('코스 이름을 입력해 주세요.')
    if (points.length === 0) return setError('포인트를 1개 이상 넣어 주세요.')
    startTransition(async () => {
      const res = await saveCourseTemplate({ id: course?.id ?? null, name, description, pointIds: points.map((p) => p.id) })
      if (!res.ok) return setError(res.error)
      setSaved(true)
      if (!course) router.replace(`${basePath}/courses/${res.id}`)
    })
  }
  const duplicate = () => {
    if (!course) return
    startTransition(async () => {
      const res = await duplicateCourseTemplate(course.id)
      if (!res.ok) return setError(res.error)
      router.push(`${basePath}/courses/${res.id}`)
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <Label htmlFor="course-name">코스 이름</Label>
          <Input
            id="course-name"
            value={name}
            maxLength={50}
            readOnly={readOnly}
            onChange={(e) => {
              setName(e.target.value)
              changed()
            }}
            placeholder="예: 중2 1학기 내신 대비"
            className="mt-1 min-h-[44px]"
          />
        </div>
        <div>
          <Label htmlFor="course-desc">설명 (선택)</Label>
          <Input
            id="course-desc"
            value={description}
            maxLength={200}
            readOnly={readOnly}
            onChange={(e) => {
              setDescription(e.target.value)
              changed()
            }}
            className="mt-1 min-h-[44px]"
          />
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <h2 className="font-semibold text-gray-900">단원 순서 ({points.length}개)</h2>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => {
                setPicked([])
                setPickerOpen(true)
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              포인트 추가
            </Button>
          )}
        </header>
        {points.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">&lsquo;포인트 추가&rsquo;로 단원을 넣어 주세요.</p>
        ) : (
          <ol className="divide-y divide-gray-100">
            {points.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 px-4 py-2">
                <span className="w-7 shrink-0 text-center text-sm font-semibold text-gray-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {p.title}
                    <span className="ml-1.5 font-mono text-xs font-normal text-gray-400">{p.code}</span>
                    {!p.published && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">공개 전</span>}
                  </p>
                  <p className="truncate text-xs text-gray-500">{p.categoryLabel}</p>
                </div>
                {!readOnly && (
                  <div className="flex shrink-0">
                    <IconButton label="위로" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="아래로" disabled={i === points.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="빼기"
                      danger
                      onClick={() => {
                        setPoints(points.filter((x) => x.id !== p.id))
                        changed()
                      }}
                    >
                      <X className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {error && <p className="text-sm text-[#D92916]">{error}</p>}
      {saved && <p className="text-sm text-[#15803D]">저장했어요. 이미 이 코스를 불러온 반의 배정은 바뀌지 않아요.</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => router.push(`${basePath}/courses`)}>
          목록으로
        </Button>
        {readOnly ? (
          <Button type="button" className="min-h-[44px]" onClick={duplicate} disabled={pending}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Copy className="mr-1.5 h-4 w-4" />}
            복제해서 고치기
          </Button>
        ) : (
          <Button type="button" className="min-h-[44px]" onClick={save} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {course ? '저장' : '코스 만들기'}
          </Button>
        )}
      </div>

      <ManageDialog open={pickerOpen} onClose={() => setPickerOpen(false)} title="포인트 추가" description="고른 순서대로 코스 끝에 붙습니다." className="max-w-2xl">
        <div className="space-y-4">
          <PointPicker tree={tree} selected={picked} onChange={setPicked} disabledIds={inCourse} disabledLabel="코스에 있음" />
          <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3">
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setPickerOpen(false)}>
              취소
            </Button>
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={picked.length === 0}
              onClick={() => {
                const add = picked.map((id) => pointById.get(id)).filter((p): p is EditorPoint => !!p && !inCourse.has(p.id))
                setPoints([...points, ...add])
                changed()
                setPickerOpen(false)
              }}
            >
              {picked.length > 0 ? `${picked.length}개 추가` : '추가'}
            </Button>
          </div>
        </div>
      </ManageDialog>
    </div>
  )
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-30',
        danger && 'hover:bg-[#FDECEA] hover:text-[#D92916]',
      )}
    >
      {children}
    </button>
  )
}
