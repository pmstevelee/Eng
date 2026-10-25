'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ScanSearch, Sparkles, Square } from 'lucide-react'
import type { GrammarPointStatus } from '@/generated/prisma'
import { Button } from '@/components/ui/button'
import { GrammarStatusBadge } from '@/components/grammar/grammar-status-badge'
import { cn } from '@/lib/utils'
import { analyzeCategoryScriptsAction, generateAndSavePointDraft } from '../../../actions'

export interface CategoryPointRow {
  id: string
  code: string
  title: string
  status: GrammarPointStatus
  hasContent: boolean
  scriptCount: number
  gapCount: number
}

type Progress = { done: number; total: number; failed: string[]; current: string | null }

export function CategoryAiTools({
  categoryId,
  points,
  scriptCount,
}: {
  categoryId: string
  points: CategoryPointRow[]
  /** 이 중분류에 쓰이는 원고 수 (대분류·포인트 원고 포함) */
  scriptCount: number
}) {
  const router = useRouter()
  const [analyzing, startAnalyze] = useTransition()
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const stopRef = useRef(false)

  const draftPoints = points.filter((p) => p.status === 'DRAFT')
  const emptyDraftPoints = draftPoints.filter((p) => !p.hasContent)
  const running = progress !== null && progress.done < progress.total && !stopRef.current

  function analyze() {
    setMessage(null)
    startAnalyze(async () => {
      const res = await analyzeCategoryScriptsAction(categoryId)
      if (!res.ok) {
        setMessage({ kind: 'error', text: res.error })
        return
      }
      setMessage({
        kind: 'ok',
        text: `분석 완료 — 충분 ${res.enough}개 · 보완 필요 ${res.partial}개 · 원고 없음 ${res.missing}개. 보완 요청을 확인해 주세요.`,
      })
      router.refresh()
    })
  }

  async function generate(targets: CategoryPointRow[]) {
    if (targets.length === 0) return
    const overwrite = targets.some((p) => p.hasContent)
    const confirmText = overwrite
      ? `초안 상태 포인트 ${targets.length}개의 개념 정리를 원고 기준으로 새로 만들어 저장합니다. 이미 쓴 내용은 바뀝니다. 계속할까요?`
      : `빈 포인트 ${targets.length}개의 개념 정리를 원고 기준으로 만들어 저장합니다. 계속할까요?`
    if (!window.confirm(confirmText)) return

    stopRef.current = false
    setMessage(null)
    const failed: string[] = []
    setProgress({ done: 0, total: targets.length, failed, current: targets[0].code })
    // 서버 시간 제한을 피하려고 포인트 하나씩 순서대로 호출
    for (let i = 0; i < targets.length; i++) {
      if (stopRef.current) break
      const p = targets[i]
      setProgress({ done: i, total: targets.length, failed: [...failed], current: `${p.code} ${p.title}` })
      const res = await generateAndSavePointDraft(p.id)
      if (!res.ok) failed.push(`${p.code}: ${res.error}`)
      setProgress({ done: i + 1, total: targets.length, failed: [...failed], current: null })
    }
    const stopped = stopRef.current
    stopRef.current = true
    setMessage({
      kind: failed.length ? 'error' : 'ok',
      text: `${stopped ? '중단됨 — ' : ''}초안 생성 ${targets.length - failed.length}개 완료${failed.length ? `, 실패 ${failed.length}개` : ''}. 각 포인트를 열어 검수해 주세요.`,
    })
    router.refresh()
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">AI 작업</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          원고 {scriptCount}건 기준. 분석으로 부족한 곳을 먼저 확인하고, 보완한 뒤 초안을 만드는 순서를 권장합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={analyze} disabled={analyzing || running || scriptCount === 0}>
          {analyzing ? <Loader2 className="animate-spin" /> : <ScanSearch className="text-[#7854F7]" />}
          {analyzing ? '원고 분석 중…' : '원고 AI 분석'}
        </Button>
        <Button
          type="button"
          onClick={() => generate(emptyDraftPoints)}
          disabled={analyzing || running || emptyDraftPoints.length === 0}
        >
          <Sparkles />
          빈 포인트 초안 생성 ({emptyDraftPoints.length})
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => generate(draftPoints)}
          disabled={analyzing || running || draftPoints.length === 0}
        >
          초안 상태 전체 다시 생성 ({draftPoints.length})
        </Button>
      </div>
      {scriptCount === 0 && <p className="text-xs text-[#8A5A00]">원고가 없어 분석할 수 없습니다. 왼쪽에서 원고를 먼저 올려 주세요.</p>}

      {progress && (
        <div className="rounded-lg bg-gray-50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">
              {progress.done} / {progress.total}
              {progress.current && <span className="ml-2 text-xs text-gray-500">{progress.current} 만드는 중…</span>}
            </span>
            {running && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11"
                onClick={() => {
                  stopRef.current = true
                }}
              >
                <Square />
                멈추기
              </Button>
            )}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-[#1865F2] transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          {progress.failed.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-[#B42318]">
              {progress.failed.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {message && (
        <p
          role="status"
          className={cn('rounded-lg px-4 py-3 text-sm', message.kind === 'ok' ? 'bg-[#E8F7EE] text-[#15803D]' : 'bg-[#FDECEA] text-[#B42318]')}
        >
          {message.text}
        </p>
      )}

      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {points.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/grammar/points/${p.code}`} className="flex min-h-[48px] items-center gap-3 px-4 py-2 hover:bg-[#F5F8FF]">
              <span className="w-24 shrink-0 font-mono text-xs text-gray-400">{p.code}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.title}</span>
              {!p.hasContent && <span className="shrink-0 text-xs text-gray-400">내용 없음</span>}
              {p.gapCount > 0 && (
                <span className="shrink-0 rounded-full bg-[#FFF4D6] px-2 py-0.5 text-xs font-semibold text-[#8A5A00]">
                  보완 {p.gapCount}
                </span>
              )}
              <GrammarStatusBadge status={p.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
