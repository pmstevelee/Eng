'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import type { GrammarPointStatus } from '@/generated/prisma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GrammarConceptView } from '@/components/grammar/grammar-concept-view'
import { GrammarStatusBadge } from '@/components/grammar/grammar-status-badge'
import { LEVELS } from '@/lib/constants/levels'
import { MIN_PUBLISH_QUESTIONS } from '@/lib/grammar/constants'
import {
  POINT_LIST_MAX,
  POINT_SUMMARY_MAX,
  POINT_TITLE_MAX,
  getPublishBlockReason,
  type GrammarPointFormInput,
} from '@/lib/grammar/point-editing'
import { parseGrammarCommonErrors, parseGrammarExamples, parseGrammarRules } from '@/types/grammar'
import { cn } from '@/lib/utils'
import { changeGrammarPointStatus, generateGrammarPointDraftAction, saveGrammarPoint } from '../../../actions'

export interface PrerequisiteOption {
  id: string
  code: string
  title: string
  group: string
}

interface RuleRow {
  text: string
  formula: string
}
interface ExampleRow {
  en: string
  ko: string
  highlight: string
}
interface ErrorRow {
  wrong: string
  correct: string
  reason: string
}
interface FormState {
  title: string
  levelMin: number
  levelMax: number
  summary: string
  rules: RuleRow[]
  examples: ExampleRow[]
  commonErrors: ErrorRow[]
  prerequisiteIds: string[]
}

type Message = { kind: 'ok' | 'error'; text: string } | null

function toFormState(v: GrammarPointFormInput): FormState {
  return {
    title: v.title,
    levelMin: v.levelMin,
    levelMax: v.levelMax,
    summary: v.summary,
    rules: v.rules.map((r) => ({ text: r.text, formula: r.formula ?? '' })),
    examples: v.examples.map((e) => ({ en: e.en, ko: e.ko, highlight: e.highlight ?? '' })),
    commonErrors: v.commonErrors.map((e) => ({ ...e })),
    prerequisiteIds: v.prerequisiteIds,
  }
}

/** 빈 행 제거·공백 정리 (미리보기·저장·변경 감지 공용) */
function toInput(f: FormState): GrammarPointFormInput {
  return {
    title: f.title.trim(),
    levelMin: f.levelMin,
    levelMax: f.levelMax,
    summary: f.summary.trim(),
    rules: parseGrammarRules(f.rules),
    examples: parseGrammarExamples(f.examples),
    commonErrors: parseGrammarCommonErrors(f.commonErrors),
    prerequisiteIds: f.prerequisiteIds,
  }
}

const textareaClass =
  'w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus-visible:outline-none focus-visible:border-primary-700 focus-visible:ring-2 focus-visible:ring-primary-100 resize-y'
const selectClass =
  'h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:border-primary-700 focus-visible:ring-2 focus-visible:ring-primary-100'

function SectionCard({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#D92916]"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}

function AddButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: string }) {
  return (
    <Button type="button" variant="outline" size="sm" className="h-11" onClick={onClick} disabled={disabled}>
      <Plus />
      {children}
    </Button>
  )
}

export function PointEditor({
  pointId,
  code,
  status,
  verifiedCount,
  options,
  initial,
}: {
  pointId: string
  code: string
  status: GrammarPointStatus
  verifiedCount: number
  options: PrerequisiteOption[]
  initial: GrammarPointFormInput
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => toFormState(initial))
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(toInput(toFormState(initial))))
  const [message, setMessage] = useState<Message>(null)
  const [prereqQuery, setPrereqQuery] = useState('')
  const [saving, startSave] = useTransition()
  const [changing, startChange] = useTransition()
  const [generating, startGenerate] = useTransition()

  const input = useMemo(() => toInput(form), [form])
  const dirty = JSON.stringify(input) !== savedSnapshot
  const busy = saving || changing || generating
  const publishBlock = getPublishBlockReason(verifiedCount)

  // 저장 안 한 채 나가려 하면 경고
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const prereqResults = useMemo(() => {
    const q = prereqQuery.trim().toLowerCase()
    if (!q) return []
    return options
      .filter((o) => !form.prerequisiteIds.includes(o.id))
      .filter((o) => o.code.toLowerCase().includes(q) || o.title.toLowerCase().includes(q))
      .slice(0, 8)
  }, [prereqQuery, options, form.prerequisiteIds])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function updateRow<K extends 'rules' | 'examples' | 'commonErrors'>(
    key: K,
    index: number,
    patch: Partial<FormState[K][number]>,
  ) {
    setForm((f) => ({
      ...f,
      [key]: (f[key] as FormState[K][number][]).map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))
  }

  function removeRow(key: 'rules' | 'examples' | 'commonErrors', index: number) {
    setForm((f) => ({ ...f, [key]: (f[key] as unknown[]).filter((_, i) => i !== index) }))
  }

  function handleGenerate() {
    const hasContent = input.summary || input.rules.length || input.examples.length || input.commonErrors.length
    if (hasContent && !window.confirm('지금 입력된 요약·규칙·예문·흔한 오류를 AI 초안으로 바꿉니다. 계속할까요?')) return
    setMessage(null)
    startGenerate(async () => {
      const res = await generateGrammarPointDraftAction(pointId, {
        title: form.title,
        levelMin: form.levelMin,
        levelMax: form.levelMax,
        prerequisiteIds: form.prerequisiteIds,
      })
      if (!res.ok) {
        setMessage({ kind: 'error', text: res.error })
        return
      }
      setForm((f) => ({
        ...f,
        summary: res.draft.summary,
        rules: res.draft.rules.map((r) => ({ text: r.text, formula: r.formula ?? '' })),
        examples: res.draft.examples.map((e) => ({ en: e.en, ko: e.ko, highlight: e.highlight ?? '' })),
        commonErrors: res.draft.commonErrors.map((e) => ({ ...e })),
      }))
      setMessage({ kind: 'ok', text: 'AI 초안을 채웠습니다. 내용을 확인·수정한 뒤 저장해 주세요.' })
    })
  }

  function handleSave() {
    setMessage(null)
    const snapshot = JSON.stringify(input)
    startSave(async () => {
      const res = await saveGrammarPoint(pointId, input)
      if (!res.ok) {
        setMessage({ kind: 'error', text: res.error })
        return
      }
      setSavedSnapshot(snapshot)
      setMessage({ kind: 'ok', text: '저장했습니다.' })
      router.refresh()
    })
  }

  function handleStatus(to: GrammarPointStatus, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setMessage(null)
    startChange(async () => {
      const res = await changeGrammarPointStatus(pointId, to)
      if (!res.ok) {
        setMessage({ kind: 'error', text: res.error })
        return
      }
      setMessage({ kind: 'ok', text: '상태를 변경했습니다.' })
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* 상단: 제목·상태·작업 버튼 */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold text-gray-900">{form.title || code}</h1>
            <GrammarStatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            검수 완료 문항{' '}
            <span
              className={cn(
                'font-semibold tabular-nums',
                verifiedCount < MIN_PUBLISH_QUESTIONS ? 'text-[#D92916]' : 'text-gray-900',
              )}
            >
              {verifiedCount}개
            </span>{' '}
            / 공개 기준 {MIN_PUBLISH_QUESTIONS}개
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleGenerate} disabled={busy}>
            {generating ? <Loader2 className="animate-spin" /> : <Sparkles className="text-[#7854F7]" />}
            {generating ? 'AI 초안 생성 중…' : 'AI 초안 생성'}
          </Button>
          <Button type="button" onClick={handleSave} disabled={busy || !dirty}>
            {saving && <Loader2 className="animate-spin" />}
            저장
          </Button>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={cn(
            'rounded-lg px-4 py-3 text-sm',
            message.kind === 'ok' ? 'bg-[#E8F7EE] text-[#15803D]' : 'bg-[#FDECEA] text-[#B42318]',
          )}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* 왼쪽: 편집 폼 */}
        <div className="space-y-4">
          <SectionCard title="기본 정보">
            <div className="space-y-4">
              <div>
                <label htmlFor="gp-title" className="mb-1.5 block text-sm font-medium text-gray-700">
                  제목
                </label>
                <Input
                  id="gp-title"
                  value={form.title}
                  maxLength={POINT_TITLE_MAX}
                  onChange={(e) => update('title', e.target.value)}
                />
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-gray-700">권장 레벨</span>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="최소 레벨"
                    className={selectClass}
                    value={form.levelMin}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setForm((f) => ({ ...f, levelMin: v, levelMax: Math.max(v, f.levelMax) }))
                    }}
                  >
                    {LEVELS.map((l) => (
                      <option key={l.level} value={l.level}>
                        Lv {l.level} ({l.cefr})
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-400">~</span>
                  <select
                    aria-label="최대 레벨"
                    className={selectClass}
                    value={form.levelMax}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setForm((f) => ({ ...f, levelMax: v, levelMin: Math.min(v, f.levelMin) }))
                    }}
                  >
                    {LEVELS.map((l) => (
                      <option key={l.level} value={l.level}>
                        Lv {l.level} ({l.cefr})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="gp-summary" className="mb-1.5 block text-sm font-medium text-gray-700">
                  한 줄 요약
                </label>
                <textarea
                  id="gp-summary"
                  rows={2}
                  maxLength={POINT_SUMMARY_MAX}
                  className={textareaClass}
                  value={form.summary}
                  onChange={(e) => update('summary', e.target.value)}
                  placeholder="예: 주어가 동작을 '당하는' 것을 나타낼 때 be동사 + 과거분사를 쓴다."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="핵심 규칙"
            hint="규칙 한 줄과, 있으면 형태 공식(예: be + p.p.)을 적습니다."
            action={
              <AddButton
                onClick={() => update('rules', [...form.rules, { text: '', formula: '' }])}
                disabled={form.rules.length >= POINT_LIST_MAX}
              >
                규칙 추가
              </AddButton>
            }
          >
            {form.rules.length === 0 ? (
              <p className="text-sm text-gray-400">규칙이 없습니다.</p>
            ) : (
              <ol className="space-y-3">
                {form.rules.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-3 w-5 shrink-0 text-right text-xs font-semibold text-gray-400">{i + 1}</span>
                    <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                      <Input
                        aria-label={`규칙 ${i + 1}`}
                        value={r.text}
                        placeholder="규칙"
                        onChange={(e) => updateRow('rules', i, { text: e.target.value })}
                      />
                      <Input
                        aria-label={`규칙 ${i + 1} 공식`}
                        value={r.formula}
                        placeholder="공식 (선택)"
                        className="font-mono"
                        onChange={(e) => updateRow('rules', i, { formula: e.target.value })}
                      />
                    </div>
                    <RemoveButton label={`규칙 ${i + 1} 삭제`} onClick={() => removeRow('rules', i)} />
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard
            title="예문"
            hint="영문과 해석. 강조할 부분은 영문 안에 있는 그대로 적어 주세요."
            action={
              <AddButton
                onClick={() => update('examples', [...form.examples, { en: '', ko: '', highlight: '' }])}
                disabled={form.examples.length >= POINT_LIST_MAX}
              >
                예문 추가
              </AddButton>
            }
          >
            {form.examples.length === 0 ? (
              <p className="text-sm text-gray-400">예문이 없습니다.</p>
            ) : (
              <ol className="space-y-3">
                {form.examples.map((e, i) => (
                  <li key={i} className="flex gap-2 rounded-lg bg-gray-50 p-3">
                    <div className="grid flex-1 gap-2">
                      <Input
                        aria-label={`예문 ${i + 1} 영문`}
                        value={e.en}
                        placeholder="영문"
                        onChange={(ev) => updateRow('examples', i, { en: ev.target.value })}
                      />
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <Input
                          aria-label={`예문 ${i + 1} 해석`}
                          value={e.ko}
                          placeholder="해석"
                          onChange={(ev) => updateRow('examples', i, { ko: ev.target.value })}
                        />
                        <Input
                          aria-label={`예문 ${i + 1} 강조`}
                          value={e.highlight}
                          placeholder="강조 (선택)"
                          className={cn(e.highlight && !e.en.includes(e.highlight.trim()) && 'border-[#FFB100]')}
                          onChange={(ev) => updateRow('examples', i, { highlight: ev.target.value })}
                        />
                      </div>
                    </div>
                    <RemoveButton label={`예문 ${i + 1} 삭제`} onClick={() => removeRow('examples', i)} />
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard
            title="흔한 오류"
            hint="학생이 자주 쓰는 틀린 문장, 고친 문장, 이유를 적습니다."
            action={
              <AddButton
                onClick={() => update('commonErrors', [...form.commonErrors, { wrong: '', correct: '', reason: '' }])}
                disabled={form.commonErrors.length >= POINT_LIST_MAX}
              >
                오류 추가
              </AddButton>
            }
          >
            {form.commonErrors.length === 0 ? (
              <p className="text-sm text-gray-400">흔한 오류가 없습니다.</p>
            ) : (
              <ol className="space-y-3">
                {form.commonErrors.map((e, i) => (
                  <li key={i} className="flex gap-2 rounded-lg bg-gray-50 p-3">
                    <div className="grid flex-1 gap-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          aria-label={`오류 ${i + 1} 틀린 문장`}
                          value={e.wrong}
                          placeholder="틀린 문장"
                          onChange={(ev) => updateRow('commonErrors', i, { wrong: ev.target.value })}
                        />
                        <Input
                          aria-label={`오류 ${i + 1} 고친 문장`}
                          value={e.correct}
                          placeholder="고친 문장"
                          onChange={(ev) => updateRow('commonErrors', i, { correct: ev.target.value })}
                        />
                      </div>
                      <textarea
                        aria-label={`오류 ${i + 1} 이유`}
                        rows={2}
                        className={textareaClass}
                        value={e.reason}
                        placeholder="이유"
                        onChange={(ev) => updateRow('commonErrors', i, { reason: ev.target.value })}
                      />
                    </div>
                    <RemoveButton label={`오류 ${i + 1} 삭제`} onClick={() => removeRow('commonErrors', i)} />
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard title="선수 포인트" hint="먼저 배우기를 권장하는 포인트입니다. 학습을 막지는 않습니다.">
            {form.prerequisiteIds.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2">
                {form.prerequisiteIds.map((id) => {
                  const o = optionById.get(id)
                  return (
                    <li
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-3 pr-1 text-sm"
                    >
                      <span className="font-mono text-xs text-gray-400">{o?.code ?? '?'}</span>
                      <span className="text-gray-800">{o?.title ?? '알 수 없는 포인트'}</span>
                      <button
                        type="button"
                        aria-label="선수 포인트 빼기"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                        onClick={() =>
                          update(
                            'prerequisiteIds',
                            form.prerequisiteIds.filter((x) => x !== id),
                          )
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <Input
              aria-label="선수 포인트 검색"
              value={prereqQuery}
              placeholder="코드나 제목으로 검색 (예: G02, 현재완료)"
              onChange={(e) => setPrereqQuery(e.target.value)}
            />
            {prereqQuery.trim() && (
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {prereqResults.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-gray-400">검색 결과가 없습니다.</li>
                ) : (
                  prereqResults.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#F5F8FF]"
                        onClick={() => {
                          update('prerequisiteIds', [...form.prerequisiteIds, o.id])
                          setPrereqQuery('')
                        }}
                      >
                        <span className="w-24 shrink-0 font-mono text-xs text-gray-400">{o.code}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-gray-900">{o.title}</span>
                          <span className="block truncate text-xs text-gray-400">{o.group}</span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </SectionCard>

          {/* 상태 변경 */}
          <SectionCard title="상태" hint="검수 요청 → 공개 순서로 진행합니다. 공개된 포인트만 학생·교사에게 보입니다.">
            <div className="flex flex-wrap gap-2">
              {status === 'DRAFT' && (
                <Button type="button" variant="outline" disabled={busy || dirty} onClick={() => handleStatus('REVIEW')}>
                  검수 요청
                </Button>
              )}
              {status !== 'PUBLISHED' && (
                <Button
                  type="button"
                  disabled={busy || dirty || publishBlock !== null}
                  onClick={() => handleStatus('PUBLISHED', '이 포인트를 공개할까요? 학생·교사 화면에 바로 보입니다.')}
                >
                  공개
                </Button>
              )}
              {status !== 'DRAFT' && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || dirty}
                  onClick={() =>
                    handleStatus(
                      'DRAFT',
                      status === 'PUBLISHED' ? '초안으로 되돌리면 학생·교사 화면에서 숨겨집니다. 계속할까요?' : undefined,
                    )
                  }
                >
                  초안으로
                </Button>
              )}
              {changing && <Loader2 className="h-5 w-5 animate-spin self-center text-gray-400" />}
            </div>
            {dirty && <p className="mt-2 text-xs text-[#8A5A00]">저장하지 않은 변경 사항이 있습니다. 저장한 뒤 상태를 바꿀 수 있습니다.</p>}
            {status !== 'PUBLISHED' && publishBlock && <p className="mt-2 text-xs text-[#D92916]">{publishBlock}</p>}
          </SectionCard>
        </div>

        {/* 오른쪽: 학생 화면 미리보기 */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">학생 화면 미리보기</span>
              {dirty && <span className="text-xs text-[#8A5A00]">저장 전</span>}
            </div>
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4 sm:p-5">
              <GrammarConceptView
                title={input.title}
                summary={input.summary || null}
                rules={input.rules}
                examples={input.examples}
                commonErrors={input.commonErrors}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
