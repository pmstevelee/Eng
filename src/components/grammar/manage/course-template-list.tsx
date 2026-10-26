'use client'

// 코스 템플릿 관리(학원장) — 우리 학원 템플릿(수정·삭제) + 본사 기본 템플릿(보기·복제)

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Copy, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteCourseTemplate, duplicateCourseTemplate } from '@/lib/grammar/manage-actions'
import type { CourseTemplateOption } from '@/lib/grammar/manage-queries'

export function CourseTemplateList({ templates, basePath }: { templates: CourseTemplateOption[]; basePath: string }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const academy = templates.filter((t) => t.scope === 'ACADEMY')
  const hq = templates.filter((t) => t.scope === 'HQ')

  const duplicate = (t: CourseTemplateOption) => {
    setBusyId(t.id)
    setError(null)
    startTransition(async () => {
      const res = await duplicateCourseTemplate(t.id)
      setBusyId(null)
      if (!res.ok) return setError(res.error)
      router.push(`${basePath}/courses/${res.id}`)
    })
  }
  const remove = (t: CourseTemplateOption) => {
    if (!window.confirm(`'${t.name}' 코스를 삭제할까요? 이미 반에 배정한 단원은 그대로 남아요.`)) return
    setBusyId(t.id)
    setError(null)
    startTransition(async () => {
      const res = await deleteCourseTemplate(t.id)
      setBusyId(null)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2.5 text-sm text-[#D92916]">{error}</p>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-gray-900">우리 학원 코스</h2>
            <p className="text-sm text-gray-500">본원과 모든 지점의 반에서 불러올 수 있어요.</p>
          </div>
          <Button asChild className="min-h-[44px]">
            <Link href={`${basePath}/courses/new`}>
              <Plus className="mr-1.5 h-4 w-4" />
              새 코스 만들기
            </Link>
          </Button>
        </div>
        {academy.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
            <Layers className="h-9 w-9 text-gray-300" aria-hidden />
            <p className="mt-3 font-medium text-gray-900">우리 학원 코스가 없습니다</p>
            <p className="mt-1 text-sm text-gray-500">아래 본사 기본 코스를 복제해서 고치거나 새로 만들어 보세요.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {academy.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {t.itemCount}개 단원{t.description ? ` · ${t.description}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button asChild variant="outline" className="min-h-[44px]">
                    <Link href={`${basePath}/courses/${t.id}`}>
                      <Pencil className="mr-1.5 h-4 w-4" />
                      수정
                    </Link>
                  </Button>
                  <Button type="button" variant="outline" className="min-h-[44px]" disabled={busyId === t.id} onClick={() => duplicate(t)}>
                    <Copy className="mr-1.5 h-4 w-4" />
                    복제
                  </Button>
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    disabled={busyId === t.id}
                    aria-label={`${t.name} 삭제`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-[#FDECEA] hover:text-[#D92916] disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900">본사 기본 코스</h2>
          <p className="text-sm text-gray-500">본사가 제공하는 코스입니다. 고치려면 복제해서 우리 학원 코스로 만드세요.</p>
        </div>
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {hq.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{t.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {t.itemCount}개 단원{t.description ? ` · ${t.description}` : ''}
                </p>
              </div>
              <div className="flex gap-1">
                <Button asChild variant="ghost" className="min-h-[44px]">
                  <Link href={`${basePath}/courses/${t.id}`}>보기</Link>
                </Button>
                <Button type="button" variant="outline" className="min-h-[44px]" disabled={busyId === t.id} onClick={() => duplicate(t)}>
                  <Copy className="mr-1.5 h-4 w-4" />
                  복제
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
