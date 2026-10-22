'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { FLASHCARD_MAX_WORDS, parseFlashcardText } from '@/lib/words/flashcard-text-parser'
import { addCardsToAiSet, generateAiFlashcards, removeWordsFromAiSet } from '@/lib/words/ai-flashcard-actions'
import type { AiFlashcardCard, AiFlashcardFailure, AiFlashcardQuotaView } from '@/types/ai-flashcard'
import { SkippedWordsNotice, type SkippedWord } from '@/components/words/skipped-words-notice'
import type { ParsedFlashcardEntry } from '@/lib/words/flashcard-text-parser'

type SetWord = { id: string; term: string; meaning: string | null; partOfSpeech: string | null }

interface Props {
  setId: string
  words: SetWord[]
  /** 세트 레벨(1~10) — AI 난이도 힌트 */
  setLevel: number
  initialQuota: AiFlashcardQuotaView
  /** 출제된 시험 때문에 남겨야 하는 최소 단어 수 */
  minWords: number
  /** 크레딧 충전 화면 (교사는 null → 학원장에게 요청 안내) */
  creditsHref: string | null
}

type DraftCard = AiFlashcardCard & { key: string; edited: boolean }

const fieldClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-700/20'

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

/** AI 플래시카드 세트의 단어 목록 — 일괄 삭제(체크 선택)와 일괄 추가(텍스트·파일 → AI) */
export function AiSetWordManager({ setId, words: serverWords, setLevel, initialQuota, minWords, creditsHref }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 추가·삭제 결과를 바로 보여주고, 서버 새로고침(진행 현황·단어 수)은 뒤에서 반영
  const [words, setWords] = useState<SetWord[]>(serverWords)
  useEffect(() => setWords(serverWords), [serverWords])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [drafts, setDrafts] = useState<DraftCard[] | null>(null)
  const [quota, setQuota] = useState(initialQuota)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  /** 추가되지 않은 단어와 사유 (입력 단계 + AI 실패 + 세트 추가 시 제외) */
  const [skipped, setSkipped] = useState<SkippedWord[]>([])
  /** AI가 만들지 못한 단어 — 다시 시도용 */
  const [failed, setFailed] = useState<AiFlashcardFailure[]>([])
  const lastEntriesRef = useRef<Map<string, ParsedFlashcardEntry>>(new Map())

  const [removing, setRemoving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const termsInSet = useMemo(() => new Set(words.map((w) => w.term.toLowerCase())), [words])
  const parsed = useMemo(() => parseFlashcardText(text), [text])
  // 이미 세트에 있는 단어는 AI로 다시 만들지 않는다 (크레딧 낭비 방지)
  const newEntries = parsed.entries.filter((e) => !termsInSet.has(e.term.toLowerCase()))
  const alreadyCount = parsed.entries.length - newEntries.length
  const overLimit = newEntries.length > FLASHCARD_MAX_WORDS

  const allSelected = words.length > 0 && selected.size === words.length
  const maxDeletable = Math.max(0, words.length - minWords)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(words.map((w) => w.id)))
  }

  function handleRemove() {
    if (selected.size === 0) return
    if (!window.confirm(`선택한 단어 ${selected.size}개를 세트에서 뺄까요? 학습 기록은 그대로 남습니다.`)) return
    setMessage(null)
    setRemoving(true)
    const ids = new Set(selected)
    removeWordsFromAiSet({ setId, wordIds: Array.from(ids) })
      .then((res) => {
        if (!res.ok) {
          setMessage({ type: 'error', text: res.error })
          return
        }
        setWords((prev) => prev.filter((w) => !ids.has(w.id)))
        setSelected(new Set())
        setMessage({ type: 'ok', text: `단어 ${fmt(res.removed)}개를 세트에서 뺐습니다.` })
        router.refresh()
      })
      .catch(() => setMessage({ type: 'error', text: '단어를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.' }))
      .finally(() => setRemoving(false))
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 200 * 1024) {
      setMessage({ type: 'error', text: '파일이 너무 큽니다. 200KB 이하의 텍스트 파일을 올려주세요.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : ''
      setText((prev) => (prev.trim() ? `${prev.trimEnd()}\n${content}` : content))
    }
    reader.onerror = () => setMessage({ type: 'error', text: '파일을 읽지 못했습니다. 텍스트(.txt, .csv) 파일인지 확인해주세요.' })
    reader.readAsText(file, 'utf-8')
  }

  function runGenerate(entries: ParsedFlashcardEntry[], inputSkipped: SkippedWord[], append: boolean) {
    setMessage(null)
    setGenerating(true)
    void (async () => {
      const res = await generateAiFlashcards({ entries, cefrLevel: setLevel, useDictionary: true })
      if (res.quota) setQuota(res.quota)
      if (!res.ok) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      const fresh = res.cards.map((c, i) => ({ ...c, key: `${Date.now()}-${i}-${c.term}`, edited: false }))
      setDrafts((prev) => (append && prev ? [...prev, ...fresh] : fresh))
      setFailed(res.failed.filter((f) => f.retryable))
      setSkipped([...inputSkipped, ...res.failed.map((f) => ({ label: f.term, reason: `${f.reason} (크레딧 차감 안 됨)` }))])
      const charge =
        res.aiCount > 0
          ? ` (AI ${fmt(res.aiCount)}개 · 무료 ${fmt(res.freeCount)}개${res.creditsUsed > 0 ? ` · ${fmt(res.creditsUsed)}크레딧 차감` : ''})`
          : ''
      setMessage({ type: 'ok', text: `카드 ${fmt(res.cards.length)}개를 만들었습니다${charge}. 확인 후 세트에 추가하세요.` })
    })()
      .catch(() =>
        setMessage({
          type: 'error',
          text: '시간이 너무 오래 걸려 중단됐습니다. 단어 수를 줄여(30개 정도) 다시 시도해주세요. 크레딧은 차감되지 않았습니다.',
        }),
      )
      .finally(() => setGenerating(false))
  }

  function handleGenerate() {
    lastEntriesRef.current = new Map(parsed.entries.map((e) => [e.term.toLowerCase(), e]))
    const inputSkipped: SkippedWord[] = [
      ...parsed.invalidLines.map((l) => ({ label: l.line, reason: l.reason })),
      ...parsed.duplicateTerms.map((t) => ({ label: t, reason: '같은 단어가 위에 이미 있어 한 번만 만들었습니다.' })),
      ...parsed.entries
        .filter((e) => termsInSet.has(e.term.toLowerCase()))
        .map((e) => ({ label: e.term, reason: '이미 세트에 있는 단어입니다.' })),
    ]
    runGenerate(newEntries, inputSkipped, false)
  }

  function retryFailed() {
    const entries = failed.map((f) => lastEntriesRef.current.get(f.term.toLowerCase()) ?? { term: f.term, meaning: null })
    const keep = skipped.filter((s) => !failed.some((f) => f.term === s.label))
    runGenerate(entries, keep, true)
  }

  function updateDraft(key: string, patch: Partial<AiFlashcardCard>) {
    setDrafts((prev) => (prev ? prev.map((c) => (c.key === key ? { ...c, ...patch, wordId: null, edited: true } : c)) : prev))
  }

  function handleAdd() {
    if (!drafts || drafts.length === 0) return
    setMessage(null)
    setSaving(true)
    void (async () => {
      const res = await addCardsToAiSet({
        setId,
        cards: drafts.map((c) => ({
          wordId: c.edited ? null : c.wordId,
          term: c.term,
          partOfSpeech: c.partOfSpeech,
          meaning: c.meaning,
          definition: c.definition,
          example: c.example,
          oxfordCefr: c.oxfordCefr,
        })),
      })
      if (!res.ok) {
        setMessage({ type: 'error', text: res.error })
        return
      }
      setWords((prev) => [...prev, ...res.words])
      setDrafts(null)
      setText('')
      setAdding(false)
      setFailed([])
      setSkipped((prev) => [...prev, ...res.skipped.map((f) => ({ label: f.term, reason: f.reason }))])
      setMessage({
        type: 'ok',
        text: `단어 ${fmt(res.added)}개를 추가했습니다.${res.skipped.length > 0 ? ` (${fmt(res.skipped.length)}개는 아래 사유로 제외)` : ''}`,
      })
      router.refresh()
    })()
      .catch(() => setMessage({ type: 'error', text: '단어를 추가하지 못했습니다. 잠시 후 다시 시도해주세요.' }))
      .finally(() => setSaving(false))
  }

  function closeAdd() {
    if (drafts && drafts.length > 0 && !window.confirm('만든 카드를 추가하지 않고 닫을까요? 이미 차감된 크레딧은 돌아오지 않습니다.')) return
    setAdding(false)
    setDrafts(null)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* 헤더: 선택 삭제 + 단어 추가 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={words.length === 0} />
            <span className="font-semibold text-gray-900">단어 목록</span>
            <span className="text-gray-500">{fmt(words.length)}개</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleRemove}
            disabled={selected.size === 0 || removing}
            className="h-11 gap-1.5 text-accent-red border-red-200 hover:bg-red-50 disabled:text-gray-400 disabled:border-gray-200"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            선택 삭제{selected.size > 0 && ` (${fmt(selected.size)})`}
          </Button>
          {!adding && (
            <Button
              type="button"
              onClick={() => {
                setAdding(true)
                setMessage(null)
              }}
              className="h-11 gap-1.5 bg-accent-purple text-white hover:bg-accent-purple/90"
            >
              <Plus className="h-4 w-4" />
              단어 추가
            </Button>
          )}
        </div>
      </div>

      {minWords > 1 && (
        <p className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          이 세트로 출제한 시험이 {minWords}문항이라 단어를 {minWords}개 이상 남겨야 합니다 (지금은 최대 {fmt(maxDeletable)}개 삭제 가능).
        </p>
      )}

      {message && (
        <div
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 border-b px-4 py-3 text-sm ${
            message.type === 'error' ? 'border-red-100 bg-red-50 text-accent-red' : 'border-green-100 bg-green-50 text-gray-900'
          }`}
        >
          {message.type === 'error' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
          )}
          {message.text}
        </div>
      )}

      {skipped.length > 0 && (
        <div className="border-b border-gray-100 p-4">
          <SkippedWordsNotice items={skipped}>
            <div className="flex flex-wrap gap-2">
              {failed.length > 0 && drafts && (
                <Button type="button" variant="outline" onClick={retryFailed} disabled={generating} className="h-11 gap-1.5 bg-white">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  만들지 못한 {failed.length}개 다시 시도
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setSkipped([])} className="h-11 bg-white">
                확인
              </Button>
            </div>
          </SkippedWordsNotice>
        </div>
      )}

      {/* 일괄 추가 패널 */}
      {adding && (
        <div className="space-y-3 border-b border-gray-100 bg-accent-purple/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-purple">
              <Sparkles className="h-4 w-4" /> 단어 일괄 추가
            </p>
            <button
              type="button"
              onClick={closeAdd}
              aria-label="단어 추가 닫기"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!drafts ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                aria-label="추가할 단어"
                placeholder={'한 줄에 한 단어씩 (뜻은 선택)\nrecycle\npollution - 오염\nlook after: 돌보다'}
                className={`${fieldClass} py-3 font-mono leading-relaxed`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className={overLimit ? 'font-semibold text-accent-red' : 'text-gray-700'}>
                    새 단어 <strong className="tabular-nums">{fmt(newEntries.length)}</strong>개
                    {overLimit && ` (한 번에 최대 ${FLASHCARD_MAX_WORDS}개)`}
                  </span>
                  {alreadyCount > 0 && <span className="text-gray-500">이미 세트에 있음 {fmt(alreadyCount)}개 제외</span>}
                  {parsed.invalidLines.length > 0 && (
                    <span className="text-accent-gold">카드로 만들 수 없는 줄 {parsed.invalidLines.length}개 (아래 사유)</span>
                  )}
                </div>
                <Button type="button" variant="outline" className="h-11 gap-1.5" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="h-4 w-4" />
                  텍스트 파일
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.tsv,text/plain,text/csv"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>
              <SkippedWordsNotice
                title="카드로 만들 수 없는 줄"
                defaultOpen={false}
                items={parsed.invalidLines.map((l) => ({ label: l.line, reason: l.reason }))}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  {quota.remainingFree === null ? '이번 달 무료 무제한' : `이번 달 무료 ${fmt(quota.remainingFree)}단어 남음`} · 크레딧{' '}
                  {fmt(quota.creditBalance)} (단어당 {fmt(quota.creditPerWord)}) · 사전에 있는 단어는 무료{' '}
                  {creditsHref ? (
                    <Link href={creditsHref} className="font-medium text-primary-700 hover:underline">
                      크레딧 충전
                    </Link>
                  ) : (
                    '· 충전은 학원장에게 요청'
                  )}
                </p>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || newEntries.length === 0 || overLimit}
                  className="h-11 gap-1.5 bg-accent-purple text-white hover:bg-accent-purple/90"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? 'AI가 만드는 중…' : `AI로 카드 만들기 (${fmt(newEntries.length)}개)`}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {drafts.map((c) => (
                  <div key={c.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2 p-2">
                    <Input
                      value={c.term}
                      onChange={(e) => updateDraft(c.key, { term: e.target.value })}
                      aria-label="단어"
                      className="h-11 font-semibold"
                    />
                    <Input
                      value={c.meaning}
                      onChange={(e) => updateDraft(c.key, { meaning: e.target.value })}
                      aria-label="뜻"
                      className="h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => (prev ? prev.filter((d) => d.key !== c.key) : prev))}
                      aria-label={`${c.term} 빼기`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-accent-red"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">영영풀이·예문은 AI가 만든 내용으로 저장됩니다.</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="h-11" onClick={() => setDrafts(null)}>
                  다시 입력
                </Button>
                <Button
                  type="button"
                  onClick={handleAdd}
                  disabled={saving || drafts.length === 0}
                  className="h-11 gap-1.5 bg-primary-700 text-white hover:bg-primary-700/90"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  세트에 {fmt(drafts.length)}개 추가
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 단어 목록 (체크해서 일괄 삭제) */}
      <div className="divide-y divide-gray-100">
        {words.map((w, i) => (
          <label key={w.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <Checkbox checked={selected.has(w.id)} onCheckedChange={() => toggle(w.id)} />
            <span className="w-6 shrink-0 text-right text-xs text-gray-400">{i + 1}</span>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <p className="text-sm font-medium text-gray-900">{w.term}</p>
              <p className="text-sm text-gray-500">{w.meaning}</p>
            </div>
          </label>
        ))}
        {words.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-500">단어가 없습니다.</p>}
      </div>
    </div>
  )
}
