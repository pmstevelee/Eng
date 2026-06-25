'use client'

import { useState, useTransition, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, X, BookOpen, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { searchWords, createTeacherWordSet } from '@/app/(dashboard)/teacher/words/actions'
import type { WordSearchResult } from '@/app/(dashboard)/teacher/words/actions'

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const CEFR_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'C1', label: 'C1' },
] as const

const LEVEL_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

const CEFR_BADGE: Record<string, { bg: string; text: string }> = {
  A1: { bg: '#EEF4FF', text: '#1865F2' },
  A2: { bg: '#EEF4FF', text: '#1865F2' },
  B1: { bg: '#F3F0FF', text: '#7854F7' },
  B2: { bg: '#F3F0FF', text: '#7854F7' },
  C1: { bg: '#FFF3EE', text: '#E35C20' },
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface SelectedWord extends WordSearchResult {
  addedAt: number
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function SetBuilderClient() {
  const router = useRouter()

  // 세트 메타데이터
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [cefrLevel, setCefrLevel] = useState(4)

  // 검색
  const [query, setQuery] = useState('')
  const [filterCefr, setFilterCefr] = useState<string>('')
  const [searchResults, setSearchResults] = useState<WordSearchResult[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchPage, setSearchPage] = useState(1)
  const [isSearching, startSearch] = useTransition()

  // 선택된 단어
  const [selectedWords, setSelectedWords] = useState<SelectedWord[]>([])
  const selectedIds = new Set(selectedWords.map((w) => w.id))

  // 저장
  const [isSaving, startSave] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // ─── 검색 실행 ──────────────────────────────────────────────────────────────

  const runSearch = useCallback(
    (q: string, cefr: string, page: number) => {
      startSearch(async () => {
        const res = await searchWords({ query: q, oxfordCefr: cefr as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | '', page })
        setSearchResults(res.words)
        setSearchTotal(res.total)
        setSearchPage(page)
      })
    },
    [],
  )

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    runSearch(query, filterCefr, 1)
  }

  function handleCefrFilter(cefr: string) {
    setFilterCefr(cefr)
    runSearch(query, cefr, 1)
  }

  // ─── 단어 추가/제거 ──────────────────────────────────────────────────────────

  function addWord(word: WordSearchResult) {
    if (selectedIds.has(word.id)) return
    setSelectedWords((prev) => [...prev, { ...word, addedAt: Date.now() }])
  }

  function removeWord(id: string) {
    setSelectedWords((prev) => prev.filter((w) => w.id !== id))
  }

  // ─── 저장 ────────────────────────────────────────────────────────────────────

  function handleSave() {
    setSaveError(null)
    if (!title.trim()) {
      setSaveError('세트 이름을 입력하세요.')
      return
    }
    if (selectedWords.length === 0) {
      setSaveError('단어를 1개 이상 추가하세요.')
      return
    }
    startSave(async () => {
      const result = await createTeacherWordSet({
        title: title.trim(),
        description: description.trim() || undefined,
        cefrLevel,
        wordIds: selectedWords.map((w) => w.id),
      })
      if (result?.error) {
        setSaveError(result.error)
      }
      // redirect는 server action 안에서 처리됨
    })
  }

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(searchTotal / PAGE_SIZE)

  // ─── 렌더 ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* 세트 기본 정보 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">세트 정보</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500 mb-1 block">세트 이름 *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: A2 핵심 동사 50개"
              className="h-11"
              maxLength={100}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">CEFR 레벨 (위고업 단계)</label>
            <select
              value={cefrLevel}
              onChange={(e) => setCefrLevel(Number(e.target.value))}
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:border-[#1865F2]"
            >
              {LEVEL_OPTIONS.map((lv) => (
                <option key={lv} value={lv}>
                  Level {lv}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">설명 (선택)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="세트 설명..."
              className="h-11"
              maxLength={300}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 단어 검색 패널 */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">단어 검색</h2>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="영단어 또는 한글 뜻 검색..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:border-[#1865F2]"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="h-10 px-4 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white rounded-xl shrink-0"
              >
                검색
              </Button>
            </form>

            {/* CEFR 필터 */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {CEFR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleCefrFilter(opt.value)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    filterCefr === opt.value
                      ? 'bg-[#1865F2] text-white border-[#1865F2]'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-[#1865F2] hover:text-[#1865F2]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 검색 결과 */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 420 }}>
            {isSearching ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                검색 중...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center px-4">
                <BookOpen className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">
                  {query || filterCefr ? '검색 결과가 없습니다.' : '영단어나 한글 뜻으로 검색하세요.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {searchResults.map((word) => {
                  const already = selectedIds.has(word.id)
                  const badge = word.oxfordCefr ? CEFR_BADGE[word.oxfordCefr] : null
                  return (
                    <div
                      key={word.id}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${already ? 'opacity-40' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-900 truncate">{word.term}</span>
                          {word.partOfSpeech && (
                            <span className="text-xs text-gray-400 shrink-0">{word.partOfSpeech}</span>
                          )}
                          {badge && word.oxfordCefr && (
                            <span
                              className="text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ backgroundColor: badge.bg, color: badge.text }}
                            >
                              {word.oxfordCefr}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{word.meaning ?? '—'}</p>
                      </div>
                      <button
                        onClick={() => addWord(word)}
                        disabled={already}
                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          already
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-[#1865F2]/10 text-[#1865F2] hover:bg-[#1865F2] hover:text-white'
                        }`}
                        aria-label={already ? '이미 추가됨' : '단어 추가'}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {searchTotal}개 중 {(searchPage - 1) * PAGE_SIZE + 1}–
                {Math.min(searchPage * PAGE_SIZE, searchTotal)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => runSearch(query, filterCefr, searchPage - 1)}
                  disabled={searchPage <= 1 || isSearching}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500 px-1">
                  {searchPage} / {totalPages}
                </span>
                <button
                  onClick={() => runSearch(query, filterCefr, searchPage + 1)}
                  disabled={searchPage >= totalPages || isSearching}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 선택된 단어 패널 */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              선택된 단어{' '}
              <span className="ml-1 px-2 py-0.5 rounded-full bg-[#1865F2]/10 text-[#1865F2] text-xs font-bold">
                {selectedWords.length}
              </span>
            </h2>
            {selectedWords.length > 0 && (
              <button
                onClick={() => setSelectedWords([])}
                className="text-xs text-gray-400 hover:text-[#D92916] transition-colors"
              >
                전체 삭제
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 420 }}>
            {selectedWords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center px-4">
                <BookOpen className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">왼쪽에서 단어를 추가하세요.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {selectedWords.map((word, i) => (
                  <div key={word.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xs text-gray-300 w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{word.term}</p>
                      <p className="text-xs text-gray-500 truncate">{word.meaning ?? '—'}</p>
                    </div>
                    <button
                      onClick={() => removeWord(word.id)}
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:bg-[#D92916]/10 hover:text-[#D92916] transition-colors"
                      aria-label="단어 제거"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 저장 에러 */}
      {saveError && (
        <div className="rounded-xl border border-[#D92916]/20 bg-[#D92916]/5 px-4 py-3 text-sm text-[#D92916]">
          {saveError}
        </div>
      )}

      {/* 하단 액션 */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-gray-500 h-11"
          disabled={isSaving}
        >
          취소
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !title.trim() || selectedWords.length === 0}
          className="h-11 px-8 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white rounded-xl font-semibold min-w-[120px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              저장 중...
            </>
          ) : (
            `세트 저장 (${selectedWords.length}단어)`
          )}
        </Button>
      </div>
    </div>
  )
}
