'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ListTodo, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createFollowUpTask,
  deleteFollowUpTask,
  setFollowUpTaskDone,
  updateStaleDays,
} from '@/lib/consultation/follow-up-actions'
import {
  FOLLOW_UP_QUICK_DUE,
  STALE_DAY_OPTIONS,
  addDaysToDateKey,
  formatDateKeyShort,
  toKstDateKey,
  todayKst,
} from '@/lib/consultation/constants'
import type { LeadDetail, TodayTaskItem } from '@/lib/consultation/queries'
import { inputClass } from './modal-shell'

type Option = { id: string; name: string }
type TaskItem = LeadDetail['followUpTasks'][number]

/** 마감일 표시: 오늘/내일/기한 경과 강조 */
function DueLabel({ dueAt, done }: { dueAt: string; done: boolean }) {
  const today = todayKst()
  const due = toKstDateKey(dueAt)
  const overdue = !done && due < today
  const label = due === today ? '오늘' : due === addDaysToDateKey(today, 1) ? '내일' : formatDateKeyShort(due)
  return (
    <span className={cn('tabular-nums', overdue ? 'text-accent-red font-medium' : 'text-gray-500')}>
      {overdue ? `${formatDateKeyShort(due)} · 기한 지남` : label}
    </span>
  )
}

function CheckButton({ done, disabled, onClick }: { done: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={done ? '완료 취소' : '완료'}
      aria-pressed={done}
      className="w-11 h-11 -ml-2 shrink-0 flex items-center justify-center disabled:opacity-50"
    >
      <span
        className={cn(
          'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
          done ? 'bg-accent-green border-accent-green text-white' : 'border-gray-300 bg-white hover:border-primary-700',
        )}
      >
        {done && <Check size={14} strokeWidth={3} />}
      </span>
    </button>
  )
}

// ─── 문의 상세: 팔로업 할 일 ───────────────────────────────────────────────────

export function FollowUpSection({
  leadId,
  tasks,
  isOwner,
  currentUserId,
  assigneeOptions,
  defaultAssigneeId,
}: {
  leadId: string
  tasks: TaskItem[]
  isOwner: boolean
  currentUserId: string
  assigneeOptions: Option[]
  defaultAssigneeId: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [dueDate, setDueDate] = useState(() => addDaysToDateKey(todayKst(), 1))
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId ?? '')

  const run = (action: () => Promise<{ error?: string }>, onDone?: () => void) => {
    setError('')
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        setError(result.error)
        return
      }
      onDone?.()
      router.refresh()
    })
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      setError('할 일 내용을 입력해주세요.')
      return
    }
    run(
      () => createFollowUpTask(leadId, { content, dueDate, assigneeId: isOwner ? assigneeId || undefined : undefined }),
      () => {
        setContent('')
        setAdding(false)
      },
    )
  }

  const openCount = tasks.filter((t) => !t.completedAt).length

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
          <ListTodo size={16} className="text-gray-500" />
          할 일 {openCount > 0 && <span className="text-gray-500 font-normal">{openCount}건</span>}
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="h-11 px-3 rounded-xl text-sm font-medium text-primary-700 hover:bg-primary-100 inline-flex items-center gap-1"
          >
            <Plus size={15} />
            추가
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="space-y-2.5 mb-4 rounded-xl bg-gray-50 p-3">
          <input
            className={inputClass}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="예: 레벨테스트 결과 안내 전화"
            maxLength={500}
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {FOLLOW_UP_QUICK_DUE.map((q) => {
              const value = addDaysToDateKey(todayKst(), q.days)
              return (
                <button
                  key={q.days}
                  type="button"
                  onClick={() => setDueDate(value)}
                  aria-pressed={dueDate === value}
                  className={cn(
                    'h-9 px-3 rounded-full border text-xs font-medium',
                    dueDate === value
                      ? 'border-primary-700 bg-primary-700 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                  )}
                >
                  {q.label}
                </button>
              )
            })}
          </div>
          <input
            type="date"
            aria-label="마감일"
            className={inputClass}
            value={dueDate}
            min={todayKst()}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
          {isOwner && assigneeOptions.length > 0 && (
            <select
              aria-label="담당자"
              className={inputClass}
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              {assigneeOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setError('')
              }}
              className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 h-11 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-50"
            >
              {isPending ? '저장 중...' : '추가'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-accent-red bg-accent-red-light px-3 py-2 rounded-lg mb-3">{error}</p>}

      {tasks.length === 0 && !adding ? (
        <p className="text-sm text-gray-500 text-center py-3">등록된 할 일이 없습니다</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => {
            const done = !!t.completedAt
            const canDelete = isOwner || t.createdById === currentUserId
            return (
              <li key={t.id} className="flex items-start gap-1">
                <CheckButton
                  done={done}
                  disabled={isPending}
                  onClick={() => run(() => setFollowUpTaskDone(t.id, !done))}
                />
                <div className="min-w-0 flex-1 py-2.5">
                  <p className={cn('text-sm break-words', done ? 'text-gray-500 line-through' : 'text-gray-900')}>
                    {t.content}
                  </p>
                  <p className="text-xs mt-0.5">
                    <DueLabel dueAt={t.dueAt} done={done} />
                    {isOwner && <span className="text-gray-500"> · {t.assignee?.name ?? '(삭제된 사용자)'}</span>}
                  </p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('이 할 일을 삭제할까요?')) run(() => deleteFollowUpTask(t.id))
                    }}
                    disabled={isPending}
                    aria-label="할 일 삭제"
                    className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-gray-500 hover:text-accent-red hover:bg-accent-red-light disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ─── 상담관리 첫 화면: 오늘 할 일 ──────────────────────────────────────────────

export function TodayTasksPanel({
  basePath,
  items,
  total,
  showAssignee,
  staleDays,
}: {
  basePath: string
  items: TodayTaskItem[]
  total: number
  showAssignee: boolean
  /** 학원장만: 방치 기준 일수 설정 */
  staleDays: number | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const overdueCount = items.filter((t) => t.overdue).length

  const run = (action: () => Promise<{ error?: string }>) => {
    setError('')
    startTransition(async () => {
      const result = await action()
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
          <ListTodo size={16} className="text-primary-700" />
          오늘 할 일
          <span className="text-sm font-normal text-gray-500">{total}건</span>
          {overdueCount > 0 && (
            <span className="rounded-full bg-accent-red-light text-accent-red px-2 py-0.5 text-xs font-semibold">
              기한 지남 {overdueCount}
            </span>
          )}
        </h2>
        {staleDays !== null && (
          <label className="flex items-center gap-2 text-sm text-gray-500">
            방치 표시 기준
            <select
              value={staleDays}
              disabled={isPending}
              onChange={(e) => run(() => updateStaleDays(parseInt(e.target.value, 10)))}
              className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
            >
              {STALE_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p className="mx-5 mt-3 text-sm text-accent-red bg-accent-red-light px-3 py-2 rounded-lg">{error}</p>}

      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500">오늘 마감이거나 기한이 지난 할 일이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-100 px-5">
          {items.map((t) => (
            <li key={t.id} className="flex items-center gap-1">
              <CheckButton done={false} disabled={isPending} onClick={() => run(() => setFollowUpTaskDone(t.id, true))} />
              <div className="min-w-0 flex-1 py-2.5">
                <p className="text-sm text-gray-900 break-words">{t.content}</p>
                <p className="text-xs mt-0.5 text-gray-500">
                  {t.canOpen ? (
                    <Link href={`${basePath}/${t.leadId}`} className="text-primary-700 hover:underline font-medium">
                      {t.studentName}
                    </Link>
                  ) : (
                    <span className="font-medium text-gray-700">{t.studentName}</span>
                  )}
                  {' · '}
                  <DueLabel dueAt={t.dueAt} done={false} />
                  {showAssignee && ` · ${t.assigneeName ?? '(삭제된 사용자)'}`}
                </p>
              </div>
            </li>
          ))}
          {total > items.length && (
            <li className="py-2.5 text-xs text-gray-500">외 {total - items.length}건 (마감일 순으로 20건까지 표시)</li>
          )}
        </ul>
      )}
    </section>
  )
}
