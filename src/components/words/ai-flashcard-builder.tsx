'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  FileUp,
  Loader2,
  PenLine,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { LEVELS } from '@/lib/constants/levels'
import { FLASHCARD_MAX_WORDS, parseFlashcardText } from '@/lib/words/flashcard-text-parser'
import { generateAiFlashcards, saveAiFlashcardSet } from '@/lib/words/ai-flashcard-actions'
import type { AiFlashcardCard, AiFlashcardFailure, AiFlashcardQuotaView } from '@/types/ai-flashcard'
import { SkippedWordsNotice, type SkippedWord } from '@/components/words/skipped-words-notice'
import { countIncompleteCards, createManualCard } from '@/lib/words/manual-flashcard'
import type { ParsedFlashcardEntry } from '@/lib/words/flashcard-text-parser'

type ClassOption = { id: string; name: string; students: { id: string; name: string }[] }

interface Props {
  classes: ClassOption[]
  initialQuota: AiFlashcardQuotaView
  /** 세트 목록 경로 (/teacher/words 또는 /owner/words) */
  basePath: string
  /** student = 학생 개인 세트 (배정 없음, 학생 크레딧 사용) */
  mode?: 'staff' | 'student'
}

const POS_OPTIONS: { value: string; label: string }[] = [
  { value: 'n', label: '명사 (n)' },
  { value: 'v', label: '동사 (v)' },
  { value: 'adj', label: '형용사 (adj)' },
  { value: 'adv', label: '부사 (adv)' },
  { value: 'prep', label: '전치사 (prep)' },
  { value: 'pron', label: '대명사 (pron)' },
  { value: 'conj', label: '접속사 (conj)' },
  { value: 'det', label: '한정사 (det)' },
  { value: 'exclam', label: '감탄사 (exclam)' },
  { value: 'phrase', label: '숙어 (phrase)' },
]
const CEFR_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

const PLACEHOLDER = `한 줄에 한 단어씩 입력하세요. 뜻은 적어도 되고 안 적어도 됩니다.

apple
banana 바나나
look forward to - 기대하다
1. environment: 환경
reduce, recycle, reuse`

const fieldClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-700/20'

type EditableCard = AiFlashcardCard & { key: string; edited: boolean }

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR')
}

export function AiFlashcardBuilder({ classes, initialQuota, basePath, mode = 'staff' }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [cefrLevel, setCefrLevel] = useState(3)
  const [useDictionary, setUseDictionary] = useState(true)
  const [quota, setQuota] = useState(initialQuota)

  const [cards, setCards] = useState<EditableCard[] | null>(null)
  const [summary, setSummary] = useState<{
    ai: number
    dictionary: number
    free: number
    credits: number
    /** AI가 만들지 못한 단어 (다시 시도 가능) */
    failed: AiFlashcardFailure[]
    /** 입력 단계에서 빠진 줄·중복 */
    skipped: SkippedWord[]
  } | null>(null)
  /** 다시 시도할 때 쓰려고 생성 당시 입력(뜻 포함)을 기억 */
  const lastEntriesRef = useRef<Map<string, ParsedFlashcardEntry>>(new Map())
  const [retrying, setRetrying] = useState(false)
  const [title, setTitle] = useState('')
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [openClass, setOpenClass] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [generating, startGenerate] = useTransition()
  const [saving, startSave] = useTransition()
  const [saved, setSaved] = useState(false)

  const parsed = useMemo(() => parseFlashcardText(text), [text])
  const overLimit = parsed.entries.length > FLASHCARD_MAX_WORDS
  const withMeaning = parsed.entries.filter((e) => e.meaning).length

  // 만든 카드를 저장하지 않고 나가면 생성에 쓴 크레딧이 사라지므로 경고
  useEffect(() => {
    if (!cards || saved) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [cards, saved])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 200 * 1024) {
      setError('파일이 너무 큽니다. 200KB 이하의 텍스트 파일을 올려주세요.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : ''
      setText((prev) => (prev.trim() ? `${prev.trimEnd()}\n${content}` : content))
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
      setError(null)
    }
    reader.onerror = () => setError('파일을 읽지 못했습니다. 텍스트(.txt, .csv) 파일인지 확인해주세요.')
    reader.readAsText(file, 'utf-8')
  }

  function handleGenerate() {
    setError(null)
    const skipped: SkippedWord[] = [
      ...parsed.invalidLines.map((l) => ({ label: l.line, reason: l.reason })),
      ...parsed.duplicateTerms.map((t) => ({ label: t, reason: '같은 단어가 위에 이미 있어 한 번만 만들었습니다.' })),
    ]
    lastEntriesRef.current = new Map(parsed.entries.map((e) => [e.term.toLowerCase(), e]))
    startGenerate(async () => {
      try {
        const res = await generateAiFlashcards({
          entries: parsed.entries,
          cefrLevel,
          useDictionary,
        })
        if (res.quota) setQuota(res.quota)
        if (!res.ok) {
          setError(res.error)
          return
        }
        setCards(res.cards.map((c, i) => ({ ...c, key: `${i}-${c.term}`, edited: false })))
        setSummary({
          ai: res.aiCount,
          dictionary: res.dictionaryCount,
          free: res.freeCount,
          credits: res.creditsUsed,
          failed: res.failed,
          skipped,
        })
      } catch {
        setError('시간이 너무 오래 걸려 중단됐습니다. 단어 수를 줄여(30개 정도) 다시 시도해주세요. 크레딧은 차감되지 않았습니다.')
      }
    })
  }

  /** AI가 만들지 못한 단어만 다시 만들어 카드 목록 뒤에 붙인다 */
  async function retryFailed() {
    if (!summary || !summary.failed.some((f) => f.retryable)) return
    setError(null)
    setRetrying(true)
    try {
      const entries = summary.failed.filter((f) => f.retryable).map(
        (f) => lastEntriesRef.current.get(f.term.toLowerCase()) ?? { term: f.term, meaning: null },
      )
      const res = await generateAiFlashcards({ entries, cefrLevel, useDictionary })
      if (res.quota) setQuota(res.quota)
      if (!res.ok) {
        setError(res.error)
        return
      }
      const existing = new Set((cards ?? []).map((c) => c.term.toLowerCase()))
      const fresh = res.cards.filter((c) => !existing.has(c.term.toLowerCase()))
      setCards((prev) => [...(prev ?? []), ...fresh.map((c, i) => ({ ...c, key: `retry-${Date.now()}-${i}`, edited: false }))])
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              ai: prev.ai + res.aiCount,
              dictionary: prev.dictionary + res.dictionaryCount,
              free: prev.free + res.freeCount,
              credits: prev.credits + res.creditsUsed,
              failed: [...prev.failed.filter((f) => !f.retryable), ...res.failed],
            }
          : prev,
      )
    } catch {
      setError('다시 시도하지 못했습니다. 잠시 후 다시 눌러주세요.')
    } finally {
      setRetrying(false)
    }
  }

  /** AI가 만들지 못한 단어를 빈 카드로 바꿔 직접 입력하게 한다 */
  function addFailedAsManual() {
    if (!summary || summary.failed.length === 0) return
    const existing = new Set((cards ?? []).map((c) => c.term.toLowerCase()))
    const manual = summary.failed
      .filter((f) => !existing.has(f.term.toLowerCase()))
      .map((f, i) => {
        const entry = lastEntriesRef.current.get(f.term.toLowerCase())
        return { ...createManualCard(f.term, entry?.meaning ?? null, cefrLevel), key: `manual-${Date.now()}-${i}`, edited: false }
      })
    setCards((prev) => [...(prev ?? []), ...manual])
    setSummary((prev) => (prev ? { ...prev, failed: [] } : prev))
  }

  function addBlankCard() {
    setCards((prev) => [...(prev ?? []), { ...createManualCard('', null, cefrLevel), key: `manual-${Date.now()}`, edited: false }])
  }

  function updateCard(key: string, patch: Partial<AiFlashcardCard>) {
    setCards((prev) =>
      prev ? prev.map((c) => (c.key === key ? { ...c, ...patch, wordId: null, edited: true } : c)) : prev,
    )
  }

  function removeCard(key: string) {
    setCards((prev) => (prev ? prev.filter((c) => c.key !== key) : prev))
  }

  function toggleStudent(id: string) {
    setAssigned((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleClass(c: ClassOption) {
    setAssigned((prev) => {
      const next = new Set(prev)
      const allIn = c.students.length > 0 && c.students.every((s) => next.has(s.id))
      for (const s of c.students) {
        if (allIn) next.delete(s.id)
        else next.add(s.id)
      }
      return next
    })
  }

  function handleSave() {
    if (!cards) return
    setError(null)
    startSave(async () => {
      const res = await saveAiFlashcardSet({
        title,
        cefrLevel,
        cards: cards.map((c) => ({
          wordId: c.edited ? null : c.wordId,
          manual: c.origin === 'MANUAL',
          term: c.term,
          partOfSpeech: c.partOfSpeech,
          meaning: c.meaning,
          definition: c.definition,
          example: c.example,
          oxfordCefr: c.oxfordCefr,
        })),
        assignedStudentIds: Array.from(assigned),
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSaved(true)
      router.push(res.redirectTo)
    })
  }

  function handleRestart() {
    if (!window.confirm('만든 카드를 버리고 단어 입력으로 돌아갈까요? 이미 차감된 크레딧은 돌아오지 않습니다.')) return
    setCards(null)
    setSummary(null)
    setError(null)
  }

  const errorBox = error && (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-accent-red">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {error}
    </div>
  )

  // ─── 1단계: 단어 입력 ──────────────────────────────────────────────────────
  if (!cards) {
    const unlimited = quota.remainingFree === null
    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">1. 단어 입력</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                직접 붙여넣거나 텍스트 파일(.txt, .csv)을 올리세요. 한 번에 최대 {FLASHCARD_MAX_WORDS}개까지 만들 수 있습니다.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-4 w-4" />
              텍스트 파일 올리기
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.tsv,text/plain,text/csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={12}
            aria-label="단어 목록"
            className={`${fieldClass} py-3 font-mono leading-relaxed`}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className={overLimit ? 'font-semibold text-accent-red' : 'text-gray-700'}>
              인식한 단어 <strong className="tabular-nums">{formatNumber(parsed.entries.length)}</strong>개
              {overLimit && ` (최대 ${FLASHCARD_MAX_WORDS}개)`}
            </span>
            <span className="text-gray-500">뜻 포함 {formatNumber(withMeaning)}개</span>
            {parsed.duplicateTerms.length > 0 && (
              <span className="text-gray-500">중복 {parsed.duplicateTerms.length}개 제외</span>
            )}
          </div>
          <SkippedWordsNotice
            title="카드로 만들 수 없는 줄"
            items={parsed.invalidLines.map((l) => ({ label: l.line, reason: l.reason }))}
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900">2. 옵션</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-gray-700">학생 레벨</span>
              <select
                value={cefrLevel}
                onChange={(e) => setCefrLevel(Number(e.target.value))}
                className={`${fieldClass} h-11`}
              >
                {LEVELS.map((l) => (
                  <option key={l.level} value={l.level}>
                    Level {l.level} · {l.cefr} ({l.nameKo})
                  </option>
                ))}
              </select>
              <span className="block text-xs text-gray-500">AI가 이 수준에 맞춰 영영풀이와 예문을 씁니다.</span>
            </label>
            <label className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 md:self-start">
              <Checkbox
                checked={useDictionary}
                onCheckedChange={(v) => setUseDictionary(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">사전에 있는 단어는 사전 내용 사용</span>
                <span className="block text-xs text-gray-500">
                  뜻을 적지 않은 단어 중 위고업 단어 사전에 있는 단어는 AI 없이 바로 카드로 만듭니다 (무료).
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-accent-purple/20 bg-accent-purple/5 p-5 space-y-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-purple">
            <Sparkles className="h-4 w-4" /> AI 플래시카드 사용량
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700">
            <span>
              이번 달 무료{' '}
              {unlimited ? (
                '무제한'
              ) : (
                <>
                  <strong className="tabular-nums">{formatNumber(quota.remainingFree ?? 0)}</strong> /{' '}
                  {formatNumber(quota.freeLimit)}단어 남음
                </>
              )}
            </span>
            <span>
              크레딧 잔액 <strong className="tabular-nums">{formatNumber(quota.creditBalance)}</strong> (단어당{' '}
              {formatNumber(quota.creditPerWord)}크레딧)
            </span>
            {quota.maxWords !== null && (
              <span>
                지금 만들 수 있는 단어 <strong className="tabular-nums">{formatNumber(quota.maxWords)}</strong>개
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            AI가 실제로 만든 단어만 차감됩니다. 무료 한도를 다 쓰면 {mode === 'student' ? '내' : '통합'} 크레딧에서
            차감됩니다.{' '}
            {mode === 'student' ? (
              <Link href="/student/credits" className="text-primary-700 font-medium hover:underline">
                크레딧 충전
              </Link>
            ) : basePath.startsWith('/owner') ? (
              <Link href="/owner/credits" className="text-primary-700 font-medium hover:underline">
                크레딧 충전
              </Link>
            ) : (
              '크레딧 충전은 학원장에게 요청하세요.'
            )}
          </p>
        </section>

        {errorBox}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href={basePath}>
            <Button type="button" variant="outline" className="h-11 w-full sm:w-auto">
              취소
            </Button>
          </Link>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generating || parsed.entries.length === 0 || overLimit || quota.blocked}
            className="h-11 gap-2 bg-accent-purple text-white hover:bg-accent-purple/90"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating
              ? 'AI가 플래시카드를 만드는 중…'
              : `AI로 플래시카드 만들기 (${formatNumber(parsed.entries.length)}개)`}
          </Button>
        </div>
      </div>
    )
  }

  // ─── 2단계: 카드 확인·수정 후 저장 ─────────────────────────────────────────
  const totalAssigned = assigned.size
  const incomplete = countIncompleteCards(cards)
  return (
    <div className="space-y-5">
      {summary && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-gray-900 space-y-1">
          <p className="font-semibold text-accent-green">
            플래시카드 {formatNumber(cards.length)}개를 만들었습니다.
          </p>
          <p className="text-gray-700">
            AI 생성 {formatNumber(summary.ai)}개 · 사전 {formatNumber(summary.dictionary)}개
            {summary.ai > 0 && (
              <>
                {' '}
                — 무료 {formatNumber(summary.free)}개 사용
                {summary.credits > 0 && `, ${formatNumber(summary.credits)}크레딧 차감`}
              </>
            )}
          </p>
          <p className="text-xs text-gray-500">내용을 확인하고 필요하면 고친 뒤 저장하세요.</p>
        </div>
      )}
      {summary && (
        <SkippedWordsNotice
          items={[
            ...summary.failed.map((f) => ({ label: f.term, reason: `${f.reason} (크레딧 차감 안 됨)` })),
            ...summary.skipped,
          ]}
        >
          {summary.failed.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {summary.failed.some((f) => f.retryable) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={retryFailed}
                  disabled={retrying}
                  className="h-11 gap-2 bg-white"
                >
                  {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  만들지 못한 {summary.failed.filter((f) => f.retryable).length}개 다시 시도
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={addFailedAsManual}
                disabled={retrying}
                className="h-11 gap-2 bg-white"
              >
                <PenLine className="h-4 w-4" />
                {summary.failed.length}개 직접 입력해서 추가
              </Button>
            </div>
          )}
        </SkippedWordsNotice>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">카드 확인</h2>
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            다시 입력
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {cards.map((c, i) => (
            <div key={c.key} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-gray-400 w-6">{i + 1}</span>
                <Input
                  value={c.term}
                  onChange={(e) => updateCard(c.key, { term: e.target.value })}
                  aria-label="단어"
                  placeholder="단어 (필수)"
                  className="h-11 flex-1 text-base font-semibold"
                />
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    c.origin === 'AI'
                      ? 'bg-accent-purple/10 text-accent-purple'
                      : c.origin === 'MANUAL'
                        ? 'bg-accent-gold/15 text-gray-900'
                        : 'bg-primary-700/10 text-primary-700'
                  }`}
                >
                  {c.origin === 'MANUAL' ? '직접 입력' : c.edited ? '수정함' : c.origin === 'AI' ? 'AI' : '사전'}
                </span>
                <button
                  type="button"
                  onClick={() => removeCard(c.key)}
                  aria-label={`${c.term} 카드 삭제`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-accent-red"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                <Input
                  value={c.meaning}
                  onChange={(e) => updateCard(c.key, { meaning: e.target.value })}
                  aria-label="뜻"
                  placeholder="뜻 (필수)"
                  className={`h-11 ${c.meaning.trim() ? '' : 'border-accent-gold'}`}
                />
                <select
                  value={c.partOfSpeech}
                  onChange={(e) => updateCard(c.key, { partOfSpeech: e.target.value })}
                  aria-label="품사"
                  className={`${fieldClass} h-11 w-28`}
                >
                  {!POS_OPTIONS.some((p) => p.value === c.partOfSpeech) && (
                    <option value={c.partOfSpeech}>{c.partOfSpeech}</option>
                  )}
                  {POS_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <select
                  value={c.oxfordCefr}
                  onChange={(e) => updateCard(c.key, { oxfordCefr: e.target.value as AiFlashcardCard['oxfordCefr'] })}
                  aria-label="단어 레벨"
                  className={`${fieldClass} h-11 w-20`}
                >
                  {CEFR_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={c.definition}
                onChange={(e) => updateCard(c.key, { definition: e.target.value })}
                aria-label="영영풀이"
                placeholder="영영풀이"
                rows={2}
                className={`${fieldClass} py-2`}
              />
              <textarea
                value={c.example}
                onChange={(e) => updateCard(c.key, { example: e.target.value })}
                aria-label="예문"
                placeholder="예문"
                rows={2}
                className={`${fieldClass} py-2 italic text-gray-700`}
              />
            </div>
          ))}
        </div>
        {cards.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
            <BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">남은 카드가 없습니다.</p>
          </div>
        )}
        <Button type="button" variant="outline" onClick={addBlankCard} className="h-11 w-full gap-2 border-dashed">
          <Plus className="h-4 w-4" />
          카드 직접 추가
        </Button>
        <p className="text-xs text-gray-500">직접 입력한 카드는 단어·뜻만 있으면 저장됩니다 (영영풀이·예문은 선택, 크레딧 차감 없음).</p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900">세트로 저장</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">세트 이름</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 중2 1과 단어"
              maxLength={100}
              className="h-11"
            />
            <span className="block text-xs text-gray-500">저장하면 이름 뒤에 오늘 날짜가 붙습니다.</span>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">세트 레벨</span>
            <select
              value={cefrLevel}
              onChange={(e) => setCefrLevel(Number(e.target.value))}
              className={`${fieldClass} h-11`}
            >
              {LEVELS.map((l) => (
                <option key={l.level} value={l.level}>
                  Level {l.level} · {l.cefr}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mode === 'staff' && (
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Users className="h-4 w-4" />
              학습할 학생 {totalAssigned > 0 && <span className="text-primary-700">({totalAssigned}명 선택)</span>}
            </p>
            <p className="text-xs text-gray-500">
              학생을 고르지 않으면 학원 전체 학생의 단어 학습 목록에 보입니다. 학생은 플래시카드·리콜·스펠링으로 학습합니다.
            </p>
            {classes.length === 0 ? (
              <p className="text-sm text-gray-400">등록된 반이 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {classes.map((cls) => {
                  const selected = cls.students.filter((s) => assigned.has(s.id)).length
                  const all = cls.students.length > 0 && selected === cls.students.length
                  const open = openClass === cls.id
                  return (
                    <div key={cls.id}>
                      <div className="flex items-center gap-3 px-3">
                        <Checkbox
                          checked={all}
                          onCheckedChange={() => toggleClass(cls)}
                          disabled={cls.students.length === 0}
                        />
                        <button
                          type="button"
                          onClick={() => setOpenClass(open ? null : cls.id)}
                          className="flex min-h-11 flex-1 items-center justify-between text-left text-sm"
                        >
                          <span className="font-medium text-gray-900">{cls.name}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            {selected}/{cls.students.length}명
                            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                          </span>
                        </button>
                      </div>
                      {open && (
                        <div className="grid grid-cols-2 gap-1 bg-gray-50 px-3 py-2 sm:grid-cols-3">
                          {cls.students.map((s) => (
                            <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm text-gray-700">
                              <Checkbox checked={assigned.has(s.id)} onCheckedChange={() => toggleStudent(s.id)} />
                              {s.name}
                            </label>
                          ))}
                          {cls.students.length === 0 && <p className="text-xs text-gray-400">학생이 없습니다.</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {errorBox}
      {incomplete > 0 && (
        <p className="text-sm text-accent-red">단어와 뜻을 모두 입력해야 저장할 수 있습니다 (빈 카드 {incomplete}개).</p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 min-h-11">
          <ChevronLeft className="h-4 w-4" />
          세트 목록
        </Link>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || cards.length === 0 || !title.trim() || incomplete > 0}
          className="h-11 gap-2 bg-primary-700 text-white hover:bg-primary-700/90"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          플래시카드 세트 저장 ({formatNumber(cards.length)}개)
        </Button>
      </div>
    </div>
  )
}
