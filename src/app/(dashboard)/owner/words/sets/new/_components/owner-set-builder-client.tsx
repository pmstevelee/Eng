'use client'

import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  X,
  BookOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Minus,
  AlertTriangle,
  ListPlus,
  ClipboardList,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  searchWordsForOwner,
  createOwnerWordSet,
  updateOwnerWordSet,
  autoCreateOwnerDailySets,
  getAvailableWordCountForOwner,
} from '@/app/(dashboard)/owner/words/_actions/sets'
import type { WordSearchResult } from '@/app/(dashboard)/owner/words/_actions/sets'

const TEST_MODE_LABELS: Record<string, string> = {
  EN_TO_KO: '영어 → 한국어 (객관식)',
  KO_TO_EN: '한국어 → 영어 (객관식)',
  SPELL: '영어 스펠링 받아쓰기',
  MIXED: '혼합 (영↔한 랜덤)',
}

const TEST_TIME_OPTIONS = [
  { value: '20', label: '20초 (쉬움)' },
  { value: '12', label: '12초 (보통)' },
  { value: '8', label: '8초 (어려움)' },
  { value: '5', label: '5초 (도전)' },
]

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

const AUTO_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
type AutoLevel = (typeof AUTO_LEVELS)[number]

function levelToOxfordCefr(level: number): AutoLevel {
  const idx = Math.min(5, Math.max(1, Math.ceil(level / 2)))
  return AUTO_LEVELS[idx - 1]
}

const DURATION_PRESETS = [
  { label: '1주', days: 7 },
  { label: '2주', days: 14 },
  { label: '3주', days: 21 },
  { label: '한 달', days: 30 },
] as const

const PER_DAY_PRESETS = [5, 8, 10, 15, 20] as const

function toDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toDateInput(d)
}

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start + 'T00:00:00').getTime()
  const e = new Date(end + 'T00:00:00').getTime()
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0
  return Math.floor((e - s) / 86_400_000) + 1
}

interface SelectedWord extends WordSearchResult {
  addedAt: number
}

interface ClassOption {
  id: string
  name: string
  students: { id: string; name: string }[]
}

interface OwnerSetBuilderClientProps {
  mode?: 'create' | 'edit'
  setId?: string
  initialTitle?: string
  initialDescription?: string
  initialCefrLevel?: number
  initialWords?: WordSearchResult[]
  classes?: ClassOption[]
}

export function OwnerSetBuilderClient({
  mode = 'create',
  setId,
  initialTitle = '',
  initialDescription = '',
  initialCefrLevel = 4,
  initialWords = [],
  classes = [],
}: OwnerSetBuilderClientProps) {
  const router = useRouter()
  const isEdit = mode === 'edit'

  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [cefrLevel, setCefrLevel] = useState(initialCefrLevel)

  const [query, setQuery] = useState('')
  const [filterCefr, setFilterCefr] = useState<string>('')
  const [searchResults, setSearchResults] = useState<WordSearchResult[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchPage, setSearchPage] = useState(1)
  const [isSearching, startSearch] = useTransition()

  const [selectedWords, setSelectedWords] = useState<SelectedWord[]>(() =>
    initialWords.map((w, i) => ({ ...w, addedAt: i })),
  )
  const selectedIds = new Set(selectedWords.map((w) => w.id))

  const today = toDateInput(new Date())
  const [autoLevels, setAutoLevels] = useState<AutoLevel[]>([])
  const [durationPreset, setDurationPreset] = useState<number | null>(30)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(addDays(today, 29))
  const [perDay, setPerDay] = useState(20)
  const [autoOrder, setAutoOrder] = useState<'recommended' | 'random'>('recommended')
  const [availableCount, setAvailableCount] = useState<number | null>(null)
  const [isAutoCreating, startAutoCreate] = useTransition()
  const [autoError, setAutoError] = useState<string | null>(null)

  const autoLevelFallback = autoLevels.length === 0
  const effectiveLevels = autoLevelFallback ? [levelToOxfordCefr(cefrLevel)] : autoLevels

  const totalDays = daysBetween(startDate, endDate)
  const neededCount = perDay * totalDays

  const [isSaving, startSave] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  // 시험 출제 옵션 (세트 저장과 동시에 시험 배정)
  const [enableTest, setEnableTest] = useState(false)
  const [testTitle, setTestTitle] = useState('')
  const [testMode, setTestMode] = useState('EN_TO_KO')
  const [testTimePerQuestion, setTestTimePerQuestion] = useState('20')
  const [testNumQuestions, setTestNumQuestions] = useState('20')
  const [testPassingScore, setTestPassingScore] = useState('80')
  const [testStartsAt, setTestStartsAt] = useState('')
  const [testEndsAt, setTestEndsAt] = useState('')
  const [testStudentIds, setTestStudentIds] = useState<string[]>([])

  function toggleTestStudent(id: string) {
    setTestStudentIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }

  function toggleTestClass(studentIds: string[]) {
    const allSelected = studentIds.length > 0 && studentIds.every((id) => testStudentIds.includes(id))
    setTestStudentIds((prev) =>
      allSelected ? prev.filter((id) => !studentIds.includes(id)) : Array.from(new Set([...prev, ...studentIds])),
    )
  }

  const searchInputRef = useRef<HTMLInputElement>(null)

  const runSearch = useCallback((q: string, cefr: string, page: number) => {
    startSearch(async () => {
      const res = await searchWordsForOwner({ query: q, oxfordCefr: cefr as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | '', page })
      setSearchResults(res.words)
      setSearchTotal(res.total)
      setSearchPage(page)
    })
  }, [])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    runSearch(query, filterCefr, 1)
  }

  function handleCefrFilter(cefr: string) {
    setFilterCefr(cefr)
    runSearch(query, cefr, 1)
  }

  function addWord(word: WordSearchResult) {
    if (selectedIds.has(word.id)) return
    setSelectedWords((prev) => [...prev, { ...word, addedAt: Date.now() }])
  }

  function removeWord(id: string) {
    setSelectedWords((prev) => prev.filter((w) => w.id !== id))
  }

  function addAllVisible() {
    const toAdd = searchResults.filter((w) => !selectedIds.has(w.id))
    if (toAdd.length === 0) return
    const now = Date.now()
    setSelectedWords((prev) => [...prev, ...toAdd.map((w, i) => ({ ...w, addedAt: now + i }))])
  }

  const visibleAddableCount = searchResults.filter((w) => !selectedIds.has(w.id)).length

  useEffect(() => {
    let cancelled = false
    setAvailableCount(null)
    const timer = setTimeout(async () => {
      const count = await getAvailableWordCountForOwner({ cefrLevels: effectiveLevels, excludeWordIds: [] })
      if (!cancelled) setAvailableCount(count)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLevels, cefrLevel])

  function toggleAutoLevel(level: AutoLevel) {
    setAutoLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
    )
  }

  function applyDurationPreset(days: number) {
    setDurationPreset(days)
    setEndDate(addDays(startDate, days - 1))
  }

  function handleStartDateChange(value: string) {
    setStartDate(value)
    if (durationPreset && value) {
      setEndDate(addDays(value, durationPreset - 1))
    } else {
      setDurationPreset(null)
    }
  }

  function handleEndDateChange(value: string) {
    setEndDate(value)
    setDurationPreset(null)
  }

  function setPerDayValue(n: number) {
    const clamped = Math.max(1, Math.min(200, n))
    setPerDay(clamped)
  }

  const usableWords =
    availableCount === null ? neededCount : Math.min(neededCount, availableCount)
  const expectedSets =
    perDay > 0 ? Math.max(1, Math.min(totalDays, Math.ceil(usableWords / perDay))) : 0
  const isShort = availableCount !== null && availableCount < neededCount

  function handleAutoCreate() {
    setAutoError(null)
    if (!title.trim()) {
      setAutoError('세트 이름을 먼저 입력하세요.')
      return
    }
    if (totalDays < 1) {
      setAutoError('학습 기간을 올바르게 설정하세요.')
      return
    }
    startAutoCreate(async () => {
      const result = await autoCreateOwnerDailySets({
        titleBase: title.trim(),
        description: description.trim() || undefined,
        cefrLevel,
        cefrLevels: effectiveLevels,
        perDay,
        totalDays,
        order: autoOrder,
      })
      if (result?.error) {
        setAutoError(result.error)
      }
    })
  }

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
    if (!isEdit && enableTest) {
      if (testStudentIds.length === 0) {
        setSaveError('시험을 배정할 학생을 한 명 이상 선택하세요.')
        return
      }
      if (Number(testNumQuestions) > selectedWords.length) {
        setSaveError(`시험 문항 수는 세트 단어 수(${selectedWords.length})를 넘을 수 없습니다.`)
        return
      }
    }
    startSave(async () => {
      const basePayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        cefrLevel,
        wordIds: selectedWords.map((w) => w.id),
      }
      if (isEdit) {
        const result = await updateOwnerWordSet(setId!, basePayload)
        if (result?.error) setSaveError(result.error)
        return
      }
      const result = await createOwnerWordSet({
        ...basePayload,
        testAssignment: enableTest
          ? {
              title: testTitle.trim() || `${title.trim()} 단어 시험`,
              mode: testMode as 'EN_TO_KO' | 'KO_TO_EN' | 'SPELL' | 'MIXED',
              timePerQuestion: Number(testTimePerQuestion),
              numQuestions: Number(testNumQuestions),
              passingScore: Number(testPassingScore),
              startsAt: testStartsAt || undefined,
              endsAt: testEndsAt || undefined,
              studentIds: testStudentIds,
            }
          : undefined,
      })
      if (result?.error) setSaveError(result.error)
    })
  }

  const PAGE_SIZE = 20
  const totalPages = Math.ceil(searchTotal / PAGE_SIZE)

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

      {/* 자동 생성 조건 (수정 모드에서는 숨김) */}
      {!isEdit && (
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#7854F7]" />
          <h2 className="text-sm font-semibold text-gray-700">자동 생성 조건</h2>
        </div>
        <p className="text-sm text-gray-500 -mt-2">
          레벨·기간·하루 학습량을 정하면 일자별 단어 세트(1일차, 2일차…)를 한 번에 만들어 드려요.
        </p>

        {/* 레벨 */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">레벨 (복수 선택 가능)</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setAutoLevels([])}
              className={`px-4 h-10 rounded-full text-sm font-semibold border transition-colors ${
                autoLevels.length === 0
                  ? 'bg-[#1865F2] text-white border-[#1865F2]'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-[#1865F2] hover:text-[#1865F2]'
              }`}
            >
              위고업 단계 따름
            </button>
            {AUTO_LEVELS.map((level) => {
              const active = autoLevels.includes(level)
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleAutoLevel(level)}
                  className={`px-4 h-10 rounded-full text-sm font-semibold border transition-colors ${
                    active
                      ? 'bg-[#1865F2] text-white border-[#1865F2]'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-[#1865F2] hover:text-[#1865F2]'
                  }`}
                >
                  {level}
                </button>
              )
            })}
          </div>
          {autoLevelFallback && (
            <p className="text-xs text-gray-500 mt-2">
              레벨을 선택하지 않아 세트 정보의{' '}
              <span className="font-semibold text-gray-700">위고업 단계(Level {cefrLevel})</span>에 맞춰{' '}
              <span className="font-semibold text-[#1865F2]">{effectiveLevels[0]}</span> 단어로 생성됩니다.
            </p>
          )}
        </div>

        {/* 학습 기간 */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">학습 기간</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyDurationPreset(preset.days)}
                className={`px-4 h-10 rounded-full text-sm font-semibold border transition-colors ${
                  durationPreset === preset.days
                    ? 'bg-[#1865F2] text-white border-[#1865F2]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-[#1865F2] hover:text-[#1865F2]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:border-[#1865F2]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">종료일</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:border-[#1865F2]"
              />
            </div>
            <span className="h-11 inline-flex items-center px-4 rounded-xl bg-[#1865F2]/10 text-[#1865F2] text-sm font-semibold">
              총 {totalDays}일
            </span>
          </div>
        </div>

        {/* 하루 학습량 */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">하루 학습량</label>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center h-12 rounded-xl border border-gray-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setPerDayValue(perDay - 1)}
                className="w-12 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-20 text-center text-base font-bold text-gray-900">{perDay}개</span>
              <button
                type="button"
                onClick={() => setPerDayValue(perDay + 1)}
                className="w-12 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap mt-3">
            {PER_DAY_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPerDayValue(n)}
                className={`px-4 h-10 rounded-full text-sm font-semibold border transition-colors ${
                  perDay === n
                    ? 'bg-[#1865F2] text-white border-[#1865F2]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-[#1865F2] hover:text-[#1865F2]'
                }`}
              >
                하루 {n}개
              </button>
            ))}
          </div>
        </div>

        {/* 단어 선택 순서 */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-500">단어 선택 순서</label>
          <div className="inline-flex p-1 rounded-xl bg-gray-100">
            {(
              [
                { value: 'recommended', label: '추천순' },
                { value: 'random', label: '무작위' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAutoOrder(opt.value)}
                className={`px-4 h-9 rounded-lg text-sm font-semibold transition-colors ${
                  autoOrder === opt.value
                    ? 'bg-[#1865F2] text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 생성 요약 */}
        <div className="text-sm text-gray-700 space-y-1">
          <p>
            필요한 단어 수: 하루 {perDay}개 × {totalDays}일 ={' '}
            <span className="font-bold text-gray-900">{neededCount}개</span>
          </p>
          <p>
            생성될 세트:{' '}
            <span className="font-bold text-[#1865F2]">
              {totalDays > 1 ? `"${title.trim() || '세트'} 1일차" 형식 ${expectedSets}개` : '1개'}
            </span>{' '}
            <span className="text-gray-400">(세트당 하루 {perDay}개)</span>
          </p>
        </div>

        {isShort && availableCount !== null && (
          <div className="flex items-start gap-2 rounded-xl border border-[#FFB100]/40 bg-[#FFB100]/10 px-4 py-3 text-sm text-[#8A6D00]">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[#FFB100]" />
            <p>
              선택한 레벨에는 {availableCount}개 단어만 있어 {neededCount - availableCount}개가
              부족해요. {expectedSets}개 일자만 생성됩니다.
            </p>
          </div>
        )}

        {autoError && (
          <div className="rounded-xl border border-[#D92916]/20 bg-[#D92916]/5 px-4 py-3 text-sm text-[#D92916]">
            {autoError}
          </div>
        )}

        <Button
          type="button"
          onClick={handleAutoCreate}
          disabled={isAutoCreating || neededCount < 1 || availableCount === 0}
          className="w-full h-12 bg-[#1865F2] hover:bg-[#1865F2]/90 text-white rounded-xl font-semibold"
        >
          {isAutoCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              세트 생성 중...
            </>
          ) : totalDays > 1 ? (
            `일자별 세트 ${expectedSets}개 자동 생성 (하루 ${perDay}개씩)`
          ) : (
            `단어 ${usableWords}개 세트 생성`
          )}
        </Button>
      </div>
      )}

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

          {searchResults.length > 0 && (
            <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {visibleAddableCount > 0
                  ? `추가할 수 있는 단어 ${visibleAddableCount}개`
                  : '이 페이지는 모두 추가됨'}
              </span>
              <button
                type="button"
                onClick={addAllVisible}
                disabled={visibleAddableCount === 0}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold text-[#1865F2] bg-[#1865F2]/10 hover:bg-[#1865F2] hover:text-white disabled:opacity-40 disabled:hover:bg-[#1865F2]/10 disabled:hover:text-[#1865F2] transition-colors"
              >
                <ListPlus className="w-3.5 h-3.5" />
                보이는 단어 {visibleAddableCount}개 한 번에 추가
              </button>
            </div>
          )}

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
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

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

      {/* 시험 출제 옵션 (수정 모드에서는 숨김) */}
      {!isEdit && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#1865F2]" />
              <h2 className="text-sm font-semibold text-gray-700">시험 출제 옵션</h2>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-500">세트 저장 후 바로 시험 출제</span>
              <Checkbox checked={enableTest} onCheckedChange={(v) => setEnableTest(Boolean(v))} />
            </label>
          </div>

          {enableTest && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">시험 제목</label>
                <Input
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder={`${title.trim() || '세트'} 단어 시험`}
                  maxLength={100}
                  className="h-11"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">문제 유형</label>
                <select
                  value={testMode}
                  onChange={(e) => setTestMode(e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:border-[#1865F2]"
                >
                  {Object.entries(TEST_MODE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">문항당 제한시간</label>
                  <select
                    value={testTimePerQuestion}
                    onChange={(e) => setTestTimePerQuestion(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:border-[#1865F2]"
                  >
                    {TEST_TIME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    문항 수 (최대 {selectedWords.length || 0})
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedWords.length || 1}
                    value={testNumQuestions}
                    onChange={(e) => setTestNumQuestions(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">합격 기준 점수 (%)</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={testPassingScore}
                  onChange={(e) => setTestPassingScore(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">시작일시 (선택)</label>
                  <input
                    type="datetime-local"
                    value={testStartsAt}
                    onChange={(e) => setTestStartsAt(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:border-[#1865F2]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">마감일시 (선택)</label>
                  <input
                    type="datetime-local"
                    value={testEndsAt}
                    onChange={(e) => setTestEndsAt(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:border-[#1865F2]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 block">배정 대상 (반 또는 학생 선택)</label>
                {classes.length === 0 ? (
                  <p className="text-sm text-gray-500">등록된 반이 없습니다.</p>
                ) : (
                  <div className="rounded-xl border border-gray-200 divide-y max-h-96 overflow-y-auto">
                    {classes.map((cls) => {
                      const classStudentIds = cls.students.map((s) => s.id)
                      const allSelected =
                        classStudentIds.length > 0 &&
                        classStudentIds.every((id) => testStudentIds.includes(id))
                      return (
                        <div key={cls.id} className="p-4">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <Checkbox checked={allSelected} onCheckedChange={() => toggleTestClass(classStudentIds)} />
                            <span className="flex-1 text-sm font-semibold text-gray-900">{cls.name}</span>
                            <span className="text-xs text-gray-400">{cls.students.length}명</span>
                          </label>
                          {cls.students.length > 0 ? (
                            <div className="mt-2 ml-7 grid grid-cols-2 gap-x-4 gap-y-1.5">
                              {cls.students.map((s) => (
                                <label key={s.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                                  <Checkbox
                                    checked={testStudentIds.includes(s.id)}
                                    onCheckedChange={() => toggleTestStudent(s.id)}
                                  />
                                  <span className="text-sm text-gray-600">{s.name}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 ml-7 text-xs text-gray-400">학생이 없습니다.</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  선택된 학생: <span className="font-semibold text-gray-900">{testStudentIds.length}명</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {saveError && (
        <div className="rounded-xl border border-[#D92916]/20 bg-[#D92916]/5 px-4 py-3 text-sm text-[#D92916]">
          {saveError}
        </div>
      )}

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
          ) : isEdit ? (
            `수정 저장 (${selectedWords.length}단어)`
          ) : (
            `세트 저장 (${selectedWords.length}단어)`
          )}
        </Button>
      </div>
    </div>
  )
}
