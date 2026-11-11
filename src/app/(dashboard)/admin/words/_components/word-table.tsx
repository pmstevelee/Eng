'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, BookOpen } from 'lucide-react'
import type { ExamCategory, OxfordCefr } from '@/generated/prisma'
import { LEVELS, LEVEL_COLORS } from '@/lib/constants/levels'
import { ExamCategoryBadges, EXAM_CATEGORY_OPTIONS } from '@/components/words/exam-category-badges'
import { updateAdminWord, type AdminWordInput } from '../actions'

export type AdminWordRow = {
  id: string
  term: string
  partOfSpeech: string
  meaning: string | null
  definition: string | null
  example: string | null
  contextNote: string | null
  cefrLevel: number
  oxfordCefr: OxfordCefr
  homonymIndex: number | null
  sourceLabel: string
  academyName: string | null
  examCategories: ExamCategory[]
  setCount: number
  updatedAt: string
}

const OXFORD_CEFRS: OxfordCefr[] = ['A1', 'A2', 'B1', 'B2', 'C1']

export function WordTable({ rows }: { rows: AdminWordRow[] }) {
  const [editing, setEditing] = useState<AdminWordRow | null>(null)

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-16 flex flex-col items-center gap-3 text-center">
        <BookOpen size={32} className="text-gray-300" />
        <p className="text-sm text-gray-500">조건에 맞는 단어가 없습니다. 검색어나 필터를 바꿔 보세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-sm uppercase">
              <th className="px-4 py-3 text-left font-medium">단어</th>
              <th className="px-4 py-3 text-left font-medium">뜻</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">예문</th>
              <th className="px-4 py-3 text-left font-medium">레벨</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">출처</th>
              <th className="px-4 py-3 text-right font-medium">수정</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((w) => {
              const color = LEVEL_COLORS[w.cefrLevel as keyof typeof LEVEL_COLORS]
              return (
                <tr key={w.id} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">
                      {w.term}
                      {w.homonymIndex !== null && (
                        <sup className="ml-0.5 text-xs text-gray-400">{w.homonymIndex}</sup>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{w.partOfSpeech}</p>
                    <ExamCategoryBadges categories={w.examCategories} className="mt-1" />
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    {w.meaning ? (
                      <p className="text-gray-900">{w.meaning}</p>
                    ) : (
                      <p className="text-accent-red text-xs">뜻 없음</p>
                    )}
                    {w.contextNote && <p className="text-xs text-gray-500 mt-0.5">({w.contextNote})</p>}
                  </td>
                  <td className="px-4 py-3 max-w-[320px] hidden lg:table-cell">
                    <p className="text-gray-600 line-clamp-2">{w.example ?? '-'}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color?.bg ?? ''} ${color?.text ?? ''}`}
                    >
                      Lv{w.cefrLevel}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">Oxford {w.oxfordCefr}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-gray-700">{w.sourceLabel}</p>
                    {w.academyName && <p className="text-xs text-gray-500">{w.academyName}</p>}
                    <p className="text-xs text-gray-400">세트 {w.setCount}개에서 사용</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(w)}
                      className="inline-flex h-11 items-center gap-1 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Pencil size={14} />
                      수정
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && <EditWordModal key={editing.id} word={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function EditWordModal({ word, onClose }: { word: AdminWordRow; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<AdminWordInput>({
    term: word.term,
    partOfSpeech: word.partOfSpeech,
    meaning: word.meaning ?? '',
    definition: word.definition ?? '',
    example: word.example ?? '',
    contextNote: word.contextNote ?? '',
    cefrLevel: word.cefrLevel,
    oxfordCefr: word.oxfordCefr,
    homonymIndex: word.homonymIndex,
    examCategories: word.examCategories,
  })

  const set = <K extends keyof AdminWordInput>(key: K, value: AdminWordInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const toggleExam = (cat: ExamCategory) =>
    set(
      'examCategories',
      form.examCategories.includes(cat)
        ? form.examCategories.filter((c) => c !== cat)
        : [...form.examCategories, cat],
    )

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateAdminWord(word.id, form)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onClose()
      router.refresh()
    })
  }

  const inputClass =
    'h-11 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-primary-700 focus:outline-none'
  const textareaClass =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-700 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">단어 수정</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              세트 {word.setCount}개에서 사용 중 · 저장하면 모든 학원 학습 화면에 바로 반영됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="sm:col-span-2 space-y-1">
              <span className="text-sm font-medium text-gray-700">단어</span>
              <input className={inputClass} value={form.term} onChange={(e) => set('term', e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">품사</span>
              <input
                className={inputClass}
                value={form.partOfSpeech}
                onChange={(e) => set('partOfSpeech', e.target.value)}
                placeholder="noun, verb …"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">한국어 뜻</span>
            <input
              className={inputClass}
              value={form.meaning}
              onChange={(e) => set('meaning', e.target.value)}
              placeholder="예: 사과"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">뜻 구분 메모</span>
            <input
              className={inputClass}
              value={form.contextNote}
              onChange={(e) => set('contextNote', e.target.value)}
              placeholder="여러 뜻이 있는 단어일 때 어떤 뜻인지 (선택)"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">영어 정의</span>
            <textarea
              rows={2}
              className={textareaClass}
              value={form.definition}
              onChange={(e) => set('definition', e.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">예문</span>
            <textarea
              rows={2}
              className={textareaClass}
              value={form.example}
              onChange={(e) => set('example', e.target.value)}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">위고업 레벨</span>
              <select
                className={inputClass}
                value={form.cefrLevel}
                onChange={(e) => set('cefrLevel', Number(e.target.value))}
              >
                {LEVELS.map((l) => (
                  <option key={l.level} value={l.level}>
                    Lv{l.level} · {l.cefr}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Oxford CEFR</span>
              <select
                className={inputClass}
                value={form.oxfordCefr}
                onChange={(e) => set('oxfordCefr', e.target.value as OxfordCefr)}
              >
                {OXFORD_CEFRS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-gray-700">동음이의어 번호</span>
              <input
                type="number"
                min={1}
                max={20}
                className={inputClass}
                value={form.homonymIndex ?? ''}
                onChange={(e) =>
                  set('homonymIndex', e.target.value === '' ? null : Number(e.target.value))
                }
                placeholder="없음"
              />
            </label>
          </div>

          <div className="space-y-1">
            <span className="text-sm font-medium text-gray-700">시험 카테고리</span>
            <div className="flex flex-wrap gap-2">
              {EXAM_CATEGORY_OPTIONS.map((opt) => {
                const active = form.examCategories.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleExam(opt.value)}
                    className={`min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary-700 bg-primary-100 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {form.term.trim() !== word.term && (
            <p className="rounded-lg bg-accent-gold-light px-3 py-2 text-xs text-gray-700">
              철자를 바꾸면 이 단어를 이미 학습한 학생의 기록도 새 철자로 보입니다. 오타 수정에만 사용하세요.
            </p>
          )}

          {error && <p className="text-sm text-accent-red">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg border border-gray-200 px-4 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="h-11 rounded-lg bg-primary-700 px-5 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
          >
            {isPending ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
