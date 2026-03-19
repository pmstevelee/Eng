'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  X,
  Search,
  Wand2,
  Send,
  Save,
  BookOpen,
  RefreshCw,
} from 'lucide-react'
import type { QuestionRow } from '@/components/shared/question-bank-client'
import type { TestFormInput, AutoConfig, QuestionRowMin } from '../../actions'

// ─── Types ───────────────────────────────────────────────────────────────────

type ClassOption = { id: string; name: string }
type DeployClass = { id: string; name: string; students: Array<{ id: string; name: string }> }

type Props = {
  classes: ClassOption[]
  questions: QuestionRow[]
  saveTestDraftAction: (input: TestFormInput) => Promise<{ error?: string; id?: string }>
  createAndDeployTestAction: (
    input: TestFormInput,
    studentIds: string[],
  ) => Promise<{ error?: string; id?: string }>
  getStudentsForDeployAction: () => Promise<{ classes: DeployClass[]; error?: string }>
  getAutoQuestionsAction: (
    configs: AutoConfig[],
  ) => Promise<{ questions: QuestionRowMin[]; error?: string }>
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
}

const DOMAIN_COLOR: Record<string, { bg: string; text: string }> = {
  GRAMMAR: { bg: '#EEF4FF', text: '#1865F2' },
  VOCABULARY: { bg: '#F3EFFF', text: '#7854F7' },
  READING: { bg: '#E6FAF8', text: '#0FBFAD' },
  WRITING: { bg: '#FEF0E8', text: '#E35C20' },
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const DOMAINS = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING'] as const
const QUESTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: '객관식',
  fill_blank: '빈칸',
  short_answer: '단답형',
  essay: '서술형',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function DomainBadge({ domain }: { domain: string }) {
  const color = DOMAIN_COLOR[domain]
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color?.bg, color: color?.text }}
    >
      {DOMAIN_LABEL[domain] ?? domain}
    </span>
  )
}

function DifficultyStars({ n }: { n: number }) {
  return (
    <span className="text-xs text-amber-400">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TestFormClient({
  classes,
  questions,
  saveTestDraftAction,
  createAndDeployTestAction,
  getStudentsForDeployAction,
  getAutoQuestionsAction,
}: Props) {
  const router = useRouter()

  // ── Basic info ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'LEVEL_TEST' | 'UNIT_TEST' | 'PRACTICE'>('LEVEL_TEST')
  const [classId, setClassId] = useState('')
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(false)
  const [timeLimitMin, setTimeLimitMin] = useState(45)
  const [instructions, setInstructions] = useState('')

  // ── Question selection ──────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState<'manual' | 'auto'>('manual')
  const [selectedQuestions, setSelectedQuestions] = useState<QuestionRow[]>([])

  // Manual mode filters
  const [filterDomain, setFilterDomain] = useState('')
  const [filterCefr, setFilterCefr] = useState('')
  const [searchText, setSearchText] = useState('')

  // Auto mode
  const [autoConfigs, setAutoConfigs] = useState<
    Array<{ domain: (typeof DOMAINS)[number]; cefrLevel: string; count: number }>
  >([{ domain: 'GRAMMAR', cefrLevel: '', count: 5 }])
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoError, setAutoError] = useState('')

  // ── Deploy modal ────────────────────────────────────────────────────────────
  const [deployOpen, setDeployOpen] = useState(false)
  const [deployClasses, setDeployClasses] = useState<DeployClass[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [deployLoading, setDeployLoading] = useState(false)
  const [deployError, setDeployError] = useState('')

  // ── Saving ──────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [formError, setFormError] = useState('')

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filterDomain && q.domain !== filterDomain) return false
      if (filterCefr && q.cefrLevel !== filterCefr) return false
      if (searchText) {
        const text = q.contentJson.question_text?.toLowerCase() ?? ''
        if (!text.includes(searchText.toLowerCase())) return false
      }
      return true
    })
  }, [questions, filterDomain, filterCefr, searchText])

  const selectedIds = new Set(selectedQuestions.map((q) => q.id))

  // ── Question selection helpers ───────────────────────────────────────────────
  function toggleQuestion(q: QuestionRow) {
    if (selectedIds.has(q.id)) {
      setSelectedQuestions((prev) => prev.filter((sq) => sq.id !== q.id))
    } else {
      setSelectedQuestions((prev) => [...prev, q])
    }
  }

  function moveQuestion(idx: number, dir: 'up' | 'down') {
    const newList = [...selectedQuestions]
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newList.length) return
    ;[newList[idx], newList[targetIdx]] = [newList[targetIdx], newList[idx]]
    setSelectedQuestions(newList)
  }

  function removeQuestion(id: string) {
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  // ── Auto config helpers ──────────────────────────────────────────────────────
  function addAutoConfig() {
    setAutoConfigs((prev) => [...prev, { domain: 'GRAMMAR', cefrLevel: '', count: 5 }])
  }

  function removeAutoConfig(idx: number) {
    setAutoConfigs((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateAutoConfig(
    idx: number,
    field: 'domain' | 'cefrLevel' | 'count',
    value: string | number,
  ) {
    setAutoConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    )
  }

  async function handleAutoGenerate() {
    setAutoLoading(true)
    setAutoError('')
    const configs: AutoConfig[] = autoConfigs
      .filter((c) => c.count > 0)
      .map((c) => ({
        domain: c.domain,
        cefrLevel: c.cefrLevel || undefined,
        count: c.count,
      }))

    const result = await getAutoQuestionsAction(configs)
    setAutoLoading(false)

    if (result.error) {
      setAutoError(result.error)
      return
    }

    // Convert QuestionRowMin to QuestionRow
    const newQuestions: QuestionRow[] = result.questions
      .filter((q) => !selectedIds.has(q.id))
      .map((q) => ({
        id: q.id,
        domain: q.domain,
        cefrLevel: q.cefrLevel,
        difficulty: q.difficulty,
        contentJson: q.contentJson,
        subCategory: q.subCategory,
        statsJson: null,
        createdAt: new Date().toISOString(),
        creator: null,
      }))

    setSelectedQuestions((prev) => [...prev, ...newQuestions])
  }

  async function replaceAutoQuestion(idx: number) {
    const current = selectedQuestions[idx]
    const configs: AutoConfig[] = [
      { domain: current.domain, cefrLevel: current.cefrLevel ?? undefined, count: 1 },
    ]
    const result = await getAutoQuestionsAction(configs)
    if (result.error || result.questions.length === 0) return

    const replacement = result.questions[0]
    if (selectedIds.has(replacement.id)) return // already selected

    const newList = [...selectedQuestions]
    newList[idx] = {
      id: replacement.id,
      domain: replacement.domain,
      cefrLevel: replacement.cefrLevel,
      difficulty: replacement.difficulty,
      contentJson: replacement.contentJson,
      subCategory: replacement.subCategory,
      statsJson: null,
      createdAt: new Date().toISOString(),
      creator: null,
    }
    setSelectedQuestions(newList)
  }

  // ── Form validation ──────────────────────────────────────────────────────────
  function buildFormInput(): TestFormInput {
    return {
      title: title.trim(),
      type,
      classId: classId || undefined,
      timeLimitMin: timeLimitEnabled ? timeLimitMin : undefined,
      instructions: instructions.trim() || undefined,
      questionIds: selectedQuestions.map((q) => q.id),
    }
  }

  function validate(): string | null {
    if (!title.trim()) return '제목을 입력해 주세요.'
    if (selectedQuestions.length === 0) return '문제를 1개 이상 선택해 주세요.'
    return null
  }

  // ── Save draft ───────────────────────────────────────────────────────────────
  async function handleSaveDraft() {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError('')
    setSaving(true)
    const result = await saveTestDraftAction(buildFormInput())
    setSaving(false)
    if (result.error) { setFormError(result.error); return }
    router.push('/teacher/tests')
  }

  // ── Open deploy modal ────────────────────────────────────────────────────────
  async function openDeployModal() {
    const err = validate()
    if (err) { setFormError(err); return }
    setFormError('')
    setDeployError('')
    setSelectedStudentIds([])
    setDeployOpen(true)
    setDeployLoading(true)
    const result = await getStudentsForDeployAction()
    setDeployClasses(result.classes)
    setDeployLoading(false)
  }

  // ── Deploy helpers ───────────────────────────────────────────────────────────
  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  function toggleClass(students: Array<{ id: string }>) {
    const ids = students.map((s) => s.id)
    const allSel = ids.every((id) => selectedStudentIds.includes(id))
    if (allSel) {
      setSelectedStudentIds((prev) => prev.filter((id) => !ids.includes(id)))
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...ids])))
    }
  }

  async function handleDeploy() {
    if (selectedStudentIds.length === 0) {
      setDeployError('배포할 학생을 선택해 주세요.')
      return
    }
    setDeploying(true)
    setDeployError('')
    const result = await createAndDeployTestAction(buildFormInput(), selectedStudentIds)
    setDeploying(false)
    if (result.error) {
      setDeployError(result.error)
    } else {
      router.push('/teacher/tests')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">새 테스트 만들기</h1>
          <p className="text-sm text-gray-500 mt-0.5">기본 정보를 입력하고 문제를 구성하세요.</p>
        </div>
      </div>

      {/* ─── Section 1: 기본 정보 ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">기본 정보</h2>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            테스트 제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 2025년 3월 레벨 테스트"
            className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          />
        </div>

        {/* 유형 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">유형</label>
          <div className="flex gap-3">
            {(
              [
                { value: 'LEVEL_TEST', label: '레벨 테스트' },
                { value: 'UNIT_TEST', label: '단원 테스트' },
                { value: 'PRACTICE', label: '연습' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer text-sm font-medium transition-colors ${
                  type === opt.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="testType"
                  value={opt.value}
                  checked={type === opt.value}
                  onChange={() => setType(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* 대상 반 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">대상 반</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          >
            <option value="">반 선택 안 함</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* 제한 시간 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">제한 시간</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={timeLimitEnabled}
                onChange={(e) => setTimeLimitEnabled(e.target.checked)}
                className="w-4 h-4 rounded accent-primary-700"
              />
              <span className="text-sm text-gray-600">시간 제한 설정</span>
            </label>
            {timeLimitEnabled && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={timeLimitMin}
                  onChange={(e) => setTimeLimitMin(Number(e.target.value))}
                  min={1}
                  max={300}
                  className="w-20 h-11 px-3 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <span className="text-sm text-gray-500">분</span>
              </div>
            )}
          </div>
        </div>

        {/* 안내문 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            시작 전 안내문 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="학생에게 표시할 안내문을 입력하세요."
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          />
        </div>
      </section>

      {/* ─── Section 2: 문제 구성 ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              문제 구성
              {selectedQuestions.length > 0 && (
                <span className="ml-2 text-sm font-normal text-primary-700">
                  ({selectedQuestions.length}문제 선택됨)
                </span>
              )}
            </h2>
            {/* 모드 탭 */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                onClick={() => setSelectionMode('manual')}
                className={`px-4 py-2 font-medium transition-colors ${
                  selectionMode === 'manual'
                    ? 'bg-primary-700 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                수동 선택
              </button>
              <button
                onClick={() => setSelectionMode('auto')}
                className={`px-4 py-2 font-medium transition-colors border-l border-gray-200 ${
                  selectionMode === 'auto'
                    ? 'bg-primary-700 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                자동 구성
              </button>
            </div>
          </div>
        </div>

        {/* ── 수동 선택 ── */}
        {selectionMode === 'manual' && (
          <div className="px-6 pb-6">
            {/* 필터 */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-48">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="문제 검색..."
                  className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <select
                value={filterDomain}
                onChange={(e) => setFilterDomain(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
              >
                <option value="">영역 전체</option>
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {DOMAIN_LABEL[d]}
                  </option>
                ))}
              </select>
              <select
                value={filterCefr}
                onChange={(e) => setFilterCefr(e.target.value)}
                className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
              >
                <option value="">레벨 전체</option>
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* 문제 목록 */}
            {questions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
                <BookOpen size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">문제 뱅크에 문제가 없습니다.</p>
                <p className="text-xs text-gray-400 mt-1">
                  먼저 문제 뱅크에서 문제를 등록해 주세요.
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="w-10 p-3" />
                        <th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          영역
                        </th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          레벨
                        </th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          문제
                        </th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                          유형
                        </th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                          난이도
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredQuestions.map((q) => {
                        const isSelected = selectedIds.has(q.id)
                        return (
                          <tr
                            key={q.id}
                            onClick={() => toggleQuestion(q)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleQuestion(q)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded accent-primary-700"
                              />
                            </td>
                            <td className="p-3">
                              <DomainBadge domain={q.domain} />
                            </td>
                            <td className="p-3">
                              <span className="text-xs text-gray-500">
                                {q.cefrLevel ?? '–'}
                              </span>
                            </td>
                            <td className="p-3 max-w-xs">
                              <span className="line-clamp-1 text-gray-800">
                                {q.contentJson.question_text}
                              </span>
                            </td>
                            <td className="p-3 hidden sm:table-cell">
                              <span className="text-xs text-gray-500">
                                {QUESTION_TYPE_LABEL[q.contentJson.type] ?? q.contentJson.type}
                              </span>
                            </td>
                            <td className="p-3 hidden sm:table-cell">
                              <DifficultyStars n={q.difficulty} />
                            </td>
                          </tr>
                        )
                      })}
                      {filteredQuestions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-sm text-gray-400">
                            조건에 맞는 문제가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
                  {filteredQuestions.length}개 문제 / 전체 {questions.length}개
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 자동 구성 ── */}
        {selectionMode === 'auto' && (
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-gray-500">
              영역별 문제 수를 설정하고 자동 선택을 실행하세요.
            </p>

            {autoConfigs.map((cfg, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50"
              >
                <select
                  value={cfg.domain}
                  onChange={(e) =>
                    updateAutoConfig(idx, 'domain', e.target.value as (typeof DOMAINS)[number])
                  }
                  className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  {DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {DOMAIN_LABEL[d]}
                    </option>
                  ))}
                </select>
                <select
                  value={cfg.cefrLevel}
                  onChange={(e) => updateAutoConfig(idx, 'cefrLevel', e.target.value)}
                  className="h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="">레벨 무관</option>
                  {CEFR_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={cfg.count}
                    onChange={(e) => updateAutoConfig(idx, 'count', Number(e.target.value))}
                    min={1}
                    max={50}
                    className="w-16 h-9 px-2 border border-gray-200 rounded-lg text-sm text-center"
                  />
                  <span className="text-sm text-gray-500">문제</span>
                </div>
                {autoConfigs.length > 1 && (
                  <button
                    onClick={() => removeAutoConfig(idx)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}

            <div className="flex gap-3">
              <button
                onClick={addAutoConfig}
                className="text-sm text-primary-700 hover:text-primary-800 font-medium"
              >
                + 조건 추가
              </button>
              <button
                onClick={handleAutoGenerate}
                disabled={autoLoading}
                className="flex items-center gap-2 px-4 py-2 bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Wand2 size={14} />
                {autoLoading ? '선택 중...' : '자동으로 문제 선택'}
              </button>
            </div>
            {autoError && <p className="text-sm text-red-600">{autoError}</p>}
          </div>
        )}

        {/* ── 선택된 문제 목록 (공통) ── */}
        {selectedQuestions.length > 0 && (
          <div className="border-t border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              선택된 문제 ({selectedQuestions.length}개)
              <span className="ml-2 text-xs text-gray-400 font-normal">
                순서를 변경할 수 있습니다.
              </span>
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {selectedQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200"
                >
                  <span className="text-xs text-gray-400 w-5 text-center shrink-0">
                    {idx + 1}
                  </span>
                  <DomainBadge domain={q.domain} />
                  <span className="text-xs text-gray-400 shrink-0">
                    {q.cefrLevel ?? '–'}
                  </span>
                  <span className="flex-1 text-sm text-gray-800 truncate">
                    {q.contentJson.question_text}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {selectionMode === 'auto' && (
                      <button
                        onClick={() => replaceAutoQuestion(idx)}
                        title="교체"
                        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                      >
                        <RefreshCw size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => moveQuestion(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveQuestion(idx, 'down')}
                      disabled={idx === selectedQuestions.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── 에러 표시 ────────────────────────────────────────────────────── */}
      {formError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      )}

      {/* ─── 액션 바 ──────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={saving || deploying}
          className="flex items-center gap-2 px-5 py-2.5 border border-primary-300 bg-white hover:bg-primary-50 disabled:opacity-50 text-primary-700 rounded-xl text-sm font-medium transition-colors"
        >
          <Save size={15} />
          {saving ? '저장 중...' : '임시저장'}
        </button>
        <button
          onClick={openDeployModal}
          disabled={saving || deploying}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Send size={15} />
          배포하기
        </button>
      </div>

      {/* ─── 배포 모달 ─────────────────────────────────────────────────────── */}
      {deployOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">테스트 배포</h2>
                <p className="text-sm text-gray-500 mt-0.5">배포할 학생을 선택하세요.</p>
              </div>
              <button
                onClick={() => setDeployOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {deployLoading ? (
                <div className="text-center py-8 text-sm text-gray-400">불러오는 중...</div>
              ) : deployClasses.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  등록된 학급이 없습니다.
                </div>
              ) : (
                deployClasses.map((cls) => {
                  const allSel =
                    cls.students.length > 0 &&
                    cls.students.every((s) => selectedStudentIds.includes(s.id))
                  return (
                    <div key={cls.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          id={`deploy-cls-${cls.id}`}
                          checked={allSel}
                          onChange={() => toggleClass(cls.students)}
                          className="w-4 h-4 rounded accent-primary-700"
                        />
                        <label
                          htmlFor={`deploy-cls-${cls.id}`}
                          className="text-sm font-semibold text-gray-800 cursor-pointer"
                        >
                          {cls.name}
                          <span className="ml-1.5 text-gray-400 font-normal">
                            ({cls.students.length}명)
                          </span>
                        </label>
                      </div>
                      <div className="ml-6 grid grid-cols-2 gap-1.5">
                        {cls.students.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`deploy-stu-${s.id}`}
                              checked={selectedStudentIds.includes(s.id)}
                              onChange={() => toggleStudent(s.id)}
                              className="w-4 h-4 rounded accent-primary-700"
                            />
                            <label
                              htmlFor={`deploy-stu-${s.id}`}
                              className="text-sm text-gray-600 cursor-pointer truncate"
                            >
                              {s.name}
                            </label>
                          </div>
                        ))}
                        {cls.students.length === 0 && (
                          <p className="text-xs text-gray-400 col-span-2">학생이 없습니다.</p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="p-5 border-t border-gray-100">
              {deployError && <p className="text-sm text-red-600 mb-3">{deployError}</p>}
              <p className="text-sm text-gray-500 mb-3">
                선택된 학생:{' '}
                <span className="font-semibold text-gray-900">
                  {selectedStudentIds.length}명
                </span>
                에게 배포됩니다.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeployOpen(false)}
                  disabled={deploying}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={deploying || selectedStudentIds.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <Send size={14} />
                  {deploying ? '배포 중...' : '배포 확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
