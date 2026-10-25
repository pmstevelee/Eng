'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ChevronDown, FileText, Loader2, MessageSquareReply, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AdminGapRow, AdminScriptRow } from '@/lib/grammar/source-scripts'
import { SCRIPT_CONTENT_MAX } from '@/lib/grammar/point-editing'
import { cn } from '@/lib/utils'
import { addSourceScript, dismissContentGap, updateSourceScript } from '../actions'

const textareaClass =
  'w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm leading-relaxed text-gray-900 placeholder:text-gray-300 focus-visible:outline-none focus-visible:border-primary-700 focus-visible:ring-2 focus-visible:ring-primary-100 resize-y'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function ScriptItem({ script }: { script: AdminScriptRow }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(script.title ?? '')
  const [content, setContent] = useState(script.content)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save(isActive: boolean) {
    setError(null)
    start(async () => {
      const res = await updateSourceScript(script.id, { title, content, isActive })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <li className={cn('rounded-lg border border-gray-200', !script.isActive && 'bg-gray-50')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left"
      >
        <FileText className={cn('h-4 w-4 shrink-0', script.isActive ? 'text-[#1865F2]' : 'text-gray-300')} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">
            {script.title || '제목 없는 원고'}
            {!script.isActive && <span className="ml-2 text-xs font-normal text-gray-400">사용 안 함</span>}
          </span>
          <span className="block truncate text-xs text-gray-400">
            {script.scopeLabel} · {script.content.length.toLocaleString()}자 · {formatDate(script.createdAt)}
            {script.createdByName ? ` · ${script.createdByName}` : ''}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-100 px-4 py-3">
          {editing ? (
            <>
              <Input value={title} maxLength={100} placeholder="원고 이름 (선택)" onChange={(e) => setTitle(e.target.value)} />
              <textarea
                rows={12}
                maxLength={SCRIPT_CONTENT_MAX}
                className={textareaClass}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" className="h-11" disabled={pending} onClick={() => save(script.isActive)}>
                  {pending && <Loader2 className="animate-spin" />}
                  저장
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11"
                  disabled={pending}
                  onClick={() => {
                    setEditing(false)
                    setTitle(script.title ?? '')
                    setContent(script.content)
                  }}
                >
                  취소
                </Button>
                <span className="text-xs text-gray-400">{content.length.toLocaleString()}자</span>
              </div>
            </>
          ) : (
            <>
              <p className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{script.content}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="h-11" onClick={() => setEditing(true)}>
                  고치기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-11"
                  disabled={pending}
                  onClick={() => save(!script.isActive)}
                >
                  {script.isActive ? 'AI 생성에서 빼기' : '다시 사용하기'}
                </Button>
              </div>
            </>
          )}
          {error && <p className="text-sm text-[#B42318]">{error}</p>}
        </div>
      )}
    </li>
  )
}

/**
 * 관리자 원고 + AI 보완 요청 패널.
 * target: 새 원고를 붙일 곳 (분류 또는 포인트). 보완 요청에 답할 때는 그 요청의 포인트·분류에 붙인다.
 */
export function ScriptPanel({
  target,
  targetLabel,
  scripts,
  gaps,
}: {
  target: { categoryId: string } | { grammarPointId: string }
  targetLabel: string
  scripts: AdminScriptRow[]
  gaps: AdminGapRow[]
}) {
  const router = useRouter()
  const formRef = useRef<HTMLDivElement>(null)
  const [showForm, setShowForm] = useState(scripts.length === 0)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [answering, setAnswering] = useState<AdminGapRow | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [pending, start] = useTransition()

  function answer(gap: AdminGapRow) {
    setAnswering(gap)
    setTitle(`보완: ${gap.message.slice(0, 40)}`)
    setShowForm(true)
    setMessage(null)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function submit() {
    setMessage(null)
    const dest = answering
      ? answering.grammarPointId
        ? { grammarPointId: answering.grammarPointId }
        : { categoryId: answering.categoryId }
      : target
    start(async () => {
      const res = await addSourceScript({ ...dest, title, content, gapId: answering?.id ?? null })
      if (!res.ok) {
        setMessage({ kind: 'error', text: res.error })
        return
      }
      setTitle('')
      setContent('')
      setAnswering(null)
      setShowForm(false)
      setMessage({ kind: 'ok', text: '원고를 저장했습니다. AI 초안을 다시 만들면 이 원고가 반영됩니다.' })
      router.refresh()
    })
  }

  function dismiss(gap: AdminGapRow) {
    if (!window.confirm('이 보완 요청을 무시할까요? 다음 AI 분석에서 다시 나올 수 있습니다.')) return
    start(async () => {
      const res = await dismissContentGap(gap.id)
      if (!res.ok) setMessage({ kind: 'error', text: res.error })
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* 보완 요청 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[#FFB100]" />
          <h2 className="text-sm font-semibold text-gray-900">AI 보완 요청</h2>
          <span className="rounded-full bg-[#FFF4D6] px-2 text-xs font-semibold text-[#8A5A00]">{gaps.length}</span>
        </div>
        {gaps.length === 0 ? (
          <p className="text-sm text-gray-400">
            열린 보완 요청이 없습니다. 원고를 올린 뒤 AI 분석이나 AI 초안 생성을 하면 부족한 부분을 알려 줍니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {gaps.map((g) => (
              <li key={g.id} className="rounded-lg border border-[#FFE3A3] bg-[#FFFBEF] px-4 py-3">
                <p className="text-xs text-gray-500">{g.scopeLabel}</p>
                <p className="mt-1 text-sm font-medium text-gray-900">{g.message}</p>
                {g.request && <p className="mt-1 text-sm text-gray-700">요청: {g.request}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" className="h-11" onClick={() => answer(g)} disabled={pending}>
                    <MessageSquareReply />
                    보완 원고 쓰기
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-11" onClick={() => dismiss(g)} disabled={pending}>
                    무시
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 원고 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">관리자 원고</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              AI는 이 원고를 기준으로 개념 정리·예문·강의를 만듭니다. 고칠 내용은 새 보완 원고로 올리면 기록이 남습니다.
            </p>
          </div>
          {!showForm && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 shrink-0"
              onClick={() => {
                setAnswering(null)
                setShowForm(true)
              }}
            >
              <Plus />
              원고 추가
            </Button>
          )}
        </div>

        {message && (
          <p
            role="status"
            className={cn(
              'mb-3 rounded-lg px-4 py-3 text-sm',
              message.kind === 'ok' ? 'bg-[#E8F7EE] text-[#15803D]' : 'bg-[#FDECEA] text-[#B42318]',
            )}
          >
            {message.text}
          </p>
        )}

        {showForm && (
          <div ref={formRef} className="mb-4 space-y-3 rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500">
              붙일 곳: <span className="font-medium text-gray-800">{answering ? answering.scopeLabel : targetLabel}</span>
            </p>
            {answering && (
              <div className="rounded-lg border border-[#FFE3A3] bg-white px-3 py-2 text-sm text-gray-700">
                <p className="font-medium text-gray-900">{answering.message}</p>
                {answering.request && <p className="mt-0.5">요청: {answering.request}</p>}
              </div>
            )}
            <Input value={title} maxLength={100} placeholder="원고 이름 (선택, 예: 수동태 기본 설명)" onChange={(e) => setTitle(e.target.value)} />
            <textarea
              rows={10}
              maxLength={SCRIPT_CONTENT_MAX}
              className={textareaClass}
              value={content}
              placeholder={
                '문법 설명 원고를 그대로 붙여 넣으세요. 형식은 자유입니다.\n예) 언제 쓰는지 / 만드는 법 / 주의할 점·예외 / 예문(영문 + 해석) / 학생이 자주 하는 실수'
              }
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className="h-11" onClick={submit} disabled={pending || !content.trim()}>
                {pending && <Loader2 className="animate-spin" />}
                원고 저장
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={pending}
                onClick={() => {
                  setShowForm(false)
                  setAnswering(null)
                }}
              >
                취소
              </Button>
              <span className="text-xs text-gray-400">
                {content.length.toLocaleString()} / {SCRIPT_CONTENT_MAX.toLocaleString()}자
              </span>
            </div>
          </div>
        )}

        {scripts.length === 0 ? (
          !showForm && <p className="text-sm text-gray-400">아직 원고가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {scripts.map((s) => (
              <ScriptItem key={s.id} script={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
