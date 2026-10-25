'use client'

// 포인트 "문항" 탭 — 연결된 본사 문항 목록, AI로 10개 생성, 검수 완료·취소, 사용 중지, 연결 해제
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import type { QuestionSource } from '@/generated/prisma'
import { Button } from '@/components/ui/button'
import { QuestionPreview, questionTypeLabel } from '@/components/grammar/question-preview'
import { MIN_PUBLISH_QUESTIONS } from '@/lib/grammar/constants'
import { GENERATED_QUESTION_COUNT } from '@/lib/grammar/question-generation'
import { getQuestionPreview } from '@/lib/grammar/question-tagging'
import type { PointQuestionRow } from '@/lib/grammar/questions'
import { cn } from '@/lib/utils'
import {
  generatePointQuestionsAction,
  setPointQuestionActive,
  setPointQuestionsVerified,
  unlinkPointQuestion,
} from '../../../question-actions'

type Message = { kind: 'ok' | 'error'; text: string } | null

const SOURCE_LABEL: Record<QuestionSource, string> = {
  SYSTEM: '기존',
  AI_GENERATED: 'AI 생성',
  AI_SHARED: 'AI 공유',
  TEACHER_CREATED: '교사 작성',
}

type Filter = 'ALL' | 'UNVERIFIED' | 'VERIFIED' | 'INACTIVE'

export function PointQuestions({
  pointId,
  questions,
  hasConcept,
}: {
  pointId: string
  questions: PointQuestionRow[]
  /** 개념 정리(요약·규칙)가 저장돼 있는지 — 없으면 생성 불가 */
  hasConcept: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('ALL')
  const [message, setMessage] = useState<Message>(null)
  const [pending, startTransition] = useTransition()
  const [generating, startGenerate] = useTransition()

  const active = questions.filter((q) => q.isActive)
  const verifiedCount = active.filter((q) => q.isVerified).length
  const unverified = active.filter((q) => !q.isVerified)
  const shown = questions.filter((q) =>
    filter === 'ALL'
      ? true
      : filter === 'UNVERIFIED'
        ? q.isActive && !q.isVerified
        : filter === 'VERIFIED'
          ? q.isActive && q.isVerified
          : !q.isActive,
  )
  const selectedIds = Array.from(selected).filter((id) => shown.some((q) => q.id === id))

  function toggle(set: Set<string>, id: string) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  function run(task: () => Promise<{ ok: true; count?: number } | { ok: false; error: string }>, okText: (n: number) => string) {
    setMessage(null)
    startTransition(async () => {
      const res = await task()
      if (res.ok) {
        setMessage({ kind: 'ok', text: okText(res.count ?? 1) })
        setSelected(new Set())
        router.refresh()
      } else setMessage({ kind: 'error', text: res.error })
    })
  }

  function generate() {
    setMessage(null)
    startGenerate(async () => {
      const res = await generatePointQuestionsAction(pointId)
      if (res.ok) {
        setMessage({
          kind: 'ok',
          text: `${res.saved}개를 만들어 검수 대기에 추가했습니다.${res.dropped > 0 ? ` (형식·중복·AI 검토에서 ${res.dropped}개 제외)` : ''} 확인 후 검수 완료해 주세요.`,
        })
        setFilter('UNVERIFIED')
        router.refresh()
      } else setMessage({ kind: 'error', text: res.error })
    })
  }

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: 'ALL', label: '전체', count: questions.length },
    { value: 'UNVERIFIED', label: '검수 대기', count: unverified.length },
    { value: 'VERIFIED', label: '검수 완료', count: verifiedCount },
    { value: 'INACTIVE', label: '사용 중지', count: questions.length - active.length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mr-auto">
          <p className="text-sm text-gray-500">검수 완료 문항</p>
          <p className={cn('text-2xl font-bold', verifiedCount < MIN_PUBLISH_QUESTIONS ? 'text-[#D92916]' : 'text-[#15803D]')}>
            {verifiedCount}
            <span className="ml-1 text-sm font-normal text-gray-500">/ 공개 기준 {MIN_PUBLISH_QUESTIONS}개</span>
          </p>
        </div>
        <Button
          type="button"
          className="min-h-[44px] bg-[#1865F2] hover:bg-[#1453c8]"
          disabled={generating || pending || !hasConcept}
          onClick={generate}
          title={hasConcept ? undefined : '개념 정리(요약·규칙)를 먼저 저장해 주세요.'}
        >
          {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
          {generating ? '문항 만들고 검토하는 중… (1분 안팎)' : `AI로 ${GENERATED_QUESTION_COUNT}개 생성`}
        </Button>
        <p className="w-full text-xs text-gray-500">
          {hasConcept
            ? '저장된 개념 정리(요약·규칙·예문·흔한 오류)를 바탕으로 객관식(빈칸·틀린 문장·어순)과 빈칸 쓰기 문제를 만들고, AI가 한 번 더 풀어 보며 정답이 둘 이상인 문제를 걸러냅니다. 검수 완료한 문항만 학생에게 출제됩니다.'
            : '개념 정리 탭에서 요약·규칙을 먼저 저장하면 AI 문항을 만들 수 있습니다.'}
        </p>
        {message && (
          <p className={cn('w-full text-sm', message.kind === 'ok' ? 'text-[#15803D]' : 'text-[#D92916]')} role="status">
            {message.text}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setFilter(f.value)
              setSelected(new Set())
            }}
            className={cn(
              'inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-medium transition-colors',
              filter === f.value
                ? 'border-[#1865F2] bg-[#1865F2] text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
            )}
          >
            {f.label}
            <span className={cn('ml-1.5 rounded-full px-1.5 text-xs', filter === f.value ? 'bg-white/20' : 'bg-gray-100 text-gray-600')}>
              {f.count}
            </span>
          </button>
        ))}
        {selectedIds.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-[44px] bg-[#1FAF54] hover:bg-[#1a9648]"
              disabled={pending}
              onClick={() => run(() => setPointQuestionsVerified(pointId, selectedIds, true), (n) => `${n}개를 검수 완료했습니다.`)}
            >
              <Check className="mr-1.5 h-4 w-4" />
              선택 검수 완료 ({selectedIds.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={pending}
              onClick={() => run(() => setPointQuestionsVerified(pointId, selectedIds, false), (n) => `${n}개의 검수를 취소했습니다.`)}
            >
              검수 취소
            </Button>
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-14 text-center">
          <Sparkles className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {questions.length === 0
              ? '연결된 문항이 없습니다. AI로 생성하거나 문항 태깅에서 기존 문항을 연결하세요.'
              : '이 조건에 맞는 문항이 없습니다.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((q, idx) => {
            const p = getQuestionPreview(q.contentJson)
            const isOpen = open.has(q.id)
            return (
              <li
                key={q.id}
                className={cn(
                  'rounded-xl border bg-white',
                  selected.has(q.id) ? 'border-[#1865F2]' : 'border-gray-200',
                  !q.isActive && 'opacity-60',
                )}
              >
                <div className="flex items-start gap-2 px-3 py-2">
                  <label className="flex h-11 w-8 shrink-0 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1865F2]"
                      checked={selected.has(q.id)}
                      onChange={() => setSelected((s) => toggle(s, q.id))}
                      aria-label={`${idx + 1}번 선택`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpen((s) => toggle(s, q.id))}
                    className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{p.text || '(본문 없음)'}</span>
                    <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">
                      {questionTypeLabel(p.type)} · Lv {q.difficulty} · {SOURCE_LABEL[q.source]}
                    </span>
                    {!q.isActive ? (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">사용 중지</span>
                    ) : q.isVerified ? (
                      <span className="shrink-0 rounded-full bg-[#E8F7EE] px-2 py-0.5 text-xs font-semibold text-[#15803D]">검수 완료</span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-[#FFF4D6] px-2 py-0.5 text-xs font-semibold text-[#8A5A00]">검수 대기</span>
                    )}
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                  </button>
                </div>
                {isOpen && (
                  <div className="space-y-3 border-t border-gray-100 px-4 py-3 sm:pl-14">
                    <p className="text-xs text-gray-400 sm:hidden">
                      {questionTypeLabel(p.type)} · Lv {q.difficulty} · {SOURCE_LABEL[q.source]}
                    </p>
                    <QuestionPreview contentJson={q.contentJson} showExplanation />
                    <div className="flex flex-wrap gap-2">
                      {q.isActive && (
                        <Button
                          type="button"
                          className={cn('min-h-[44px]', !q.isVerified && 'bg-[#1FAF54] hover:bg-[#1a9648]')}
                          variant={q.isVerified ? 'outline' : 'default'}
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => setPointQuestionsVerified(pointId, [q.id], !q.isVerified),
                              () => (q.isVerified ? '검수를 취소했습니다.' : '검수 완료했습니다.'),
                            )
                          }
                        >
                          {q.isVerified ? '검수 취소' : (
                            <>
                              <Check className="mr-1 h-4 w-4" />
                              검수 완료
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px]"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => setPointQuestionActive(pointId, q.id, !q.isActive),
                            () => (q.isActive ? '사용 중지했습니다. 학생에게 출제되지 않습니다.' : '다시 사용합니다.'),
                          )
                        }
                      >
                        {q.isActive ? '사용 중지' : '다시 사용'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-[44px] text-gray-600"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm('이 문항을 포인트에서 떼어낼까요? 태깅으로 붙은 문항이면 태깅 검수 목록으로 돌아갑니다.')) return
                          run(() => unlinkPointQuestion(pointId, q.id), () => '포인트 연결을 해제했습니다.')
                        }}
                      >
                        연결 해제
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
