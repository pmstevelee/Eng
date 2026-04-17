'use client'

import { useState, useTransition, useMemo } from 'react'
import { Search, ChevronDown, Loader2, Eye, EyeOff, Pencil, Volume2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deactivateQuestion, activateQuestion, adjustDifficulty, updateQuestion, bulkDeleteQuestions } from '../actions'
import type { AdminQuestionRow, UpdateQuestionPayload } from '../actions'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
  LISTENING: '듣기',
}

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
  LISTENING: '#1FAF54',
}

const SOURCE_LABEL: Record<string, string> = {
  SYSTEM: '시스템',
  AI_GENERATED: 'AI 생성',
  AI_SHARED: 'AI 공유',
  TEACHER_CREATED: '교사 출제',
}

// AI_SHARED는 별도 스타일로 구분 (유저가 생성한 유사문제가 공용 풀로 공유된 것)
const SOURCE_STYLE: Record<string, { bg: string; text: string; border?: string }> = {
  SYSTEM: { bg: '#1865F2', text: '#fff' },
  AI_GENERATED: { bg: '#7854F7', text: '#fff' },
  AI_SHARED: { bg: '#FFF8E6', text: '#B45309', border: '#FFB100' },
  TEACHER_CREATED: { bg: '#E35C20', text: '#fff' },
}

function QualityStars({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300 text-xs">-</span>
  const stars = score >= 0.7 ? 3 : score >= 0.4 ? 2 : 1
  return (
    <span className="text-amber-400 text-sm" title={`품질: ${score.toFixed(2)}`}>
      {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
    </span>
  )
}

function SourceBadge({ source }: { source: string }) {
  const style = SOURCE_STYLE[source] ?? { bg: '#999', text: '#fff' }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{
        background: style.bg,
        color: style.text,
        border: style.border ? `1px solid ${style.border}` : undefined,
      }}
    >
      {source === 'AI_SHARED' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
      )}
      {SOURCE_LABEL[source] ?? source}
    </span>
  )
}

// ── 전체보기/수정 모달 ─────────────────────────────────────────────────────────

type EditModalProps = {
  question: AdminQuestionRow
  onClose: () => void
  onSaved: (updated: AdminQuestionRow) => void
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: '객관식',
  fill_blank: '빈칸 채우기',
  short_answer: '단답형',
  essay: '서술형',
  word_bank: '단어 배열',
  question_set: '복합 문제',
  sentence_order: '순서맞추기',
}

function EditModal({ question, onClose, onSaved }: EditModalProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [questionType, setQuestionType] = useState(question.questionType)
  const [questionText, setQuestionText] = useState(question.questionText)
  const [options, setOptions] = useState<string[]>(
    question.questionType === 'multiple_choice'
      ? (question.options.length > 0 ? [...question.options] : ['', '', '', '', ''])
      : [],
  )
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer)
  const [explanation, setExplanation] = useState(question.explanation)
  const [difficulty, setDifficulty] = useState(question.difficulty)
  const [audioUrl, setAudioUrl] = useState(question.audioUrl ?? '')
  const [saving, startSave] = useTransition()
  const [saveError, setSaveError] = useState('')

  const isMultipleChoice = questionType === 'multiple_choice'
  const isEssay = questionType === 'essay'

  // 문제 유형 변경 시 관련 state 초기화
  function handleTypeChange(newType: string) {
    setQuestionType(newType)
    if (newType === 'multiple_choice') {
      setOptions(question.options.length > 0 ? [...question.options] : ['', '', '', '', ''])
      setCorrectAnswer(question.correctAnswer || 'A')
    } else {
      setOptions([])
      if (newType === 'essay') {
        setCorrectAnswer('')
      } else {
        // fill_blank / short_answer: 기존 정답이 A~E 단일문자면 초기화
        const isLetterOnly = /^[A-E]$/.test(correctAnswer)
        setCorrectAnswer(isLetterOnly ? '' : correctAnswer)
      }
    }
  }

  function handleOptionChange(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)))
  }

  function handleSave() {
    setSaveError('')
    const payload: UpdateQuestionPayload = {
      questionType,
      questionText,
      options: isMultipleChoice ? options : [],
      correctAnswer: isEssay ? '' : correctAnswer,
      explanation,
      difficulty,
      audioUrl: audioUrl || null,
    }
    startSave(async () => {
      const res = await updateQuestion(question.id, payload)
      if (res.error) {
        setSaveError(res.error)
        return
      }
      onSaved({
        ...question,
        questionType,
        questionText,
        options: isMultipleChoice ? options : [],
        correctAnswer: isEssay ? '' : correctAnswer,
        explanation,
        difficulty,
        audioUrl: audioUrl || null,
      })
      onClose()
    })
  }

  const answerLetters = ['A', 'B', 'C', 'D', 'E']

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ background: DOMAIN_COLOR[question.domain] }}
            >
              {DOMAIN_LABEL[question.domain]}
            </span>
            <span className="text-xs text-gray-500">Lv{question.difficulty}</span>
            {mode === 'edit' ? (
              <select
                value={questionType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="h-6 text-xs rounded-full border border-gray-200 px-2 text-gray-600 bg-gray-50"
              >
                {Object.entries(QUESTION_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {QUESTION_TYPE_LABEL[questionType] ?? questionType}
              </span>
            )}
            <SourceBadge source={question.source} />
            {question.source === 'AI_SHARED' && question.originalQuestionId && (
              <span className="text-xs text-gray-400">
                (원본: {question.originalQuestionId.slice(0, 8)}…)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === 'view' ? (
              <button
                onClick={() => setMode('edit')}
                className="flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
              >
                <Pencil size={12} /> 수정
              </button>
            ) : (
              <button
                onClick={() => setMode('view')}
                className="text-xs text-gray-500 hover:underline"
              >
                취소
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-2">
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 문제 텍스트 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">문제</label>
            {mode === 'edit' ? (
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{questionText}</p>
            )}
          </div>

          {/* 오디오 URL (듣기 영역) */}
          {(question.domain === 'LISTENING' || audioUrl) && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Volume2 size={12} /> 오디오
              </label>
              {mode === 'edit' ? (
                <Input
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="오디오 URL 입력..."
                  className="mt-1 h-9 text-sm"
                />
              ) : audioUrl ? (
                <audio controls src={audioUrl} className="mt-1 w-full h-10" />
              ) : (
                <p className="mt-1 text-sm text-gray-400">없음</p>
              )}
            </div>
          )}

          {/* 보기 (객관식만) */}
          {isMultipleChoice && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">보기</label>
              <div className="mt-2 space-y-2">
                {options.map((opt, idx) => {
                  const letter = answerLetters[idx] ?? String(idx + 1)
                  const isCorrect = correctAnswer === letter
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isCorrect ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {letter}
                      </span>
                      {mode === 'edit' ? (
                        <input
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                        />
                      ) : (
                        <span className={`text-sm ${isCorrect ? 'font-semibold text-green-700' : 'text-gray-700'}`}>
                          {opt}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 정답 + 난이도 */}
          <div className="grid grid-cols-2 gap-4">
            {!isEssay && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">정답</label>
                {mode === 'edit' ? (
                  isMultipleChoice ? (
                    <select
                      value={correctAnswer}
                      onChange={(e) => setCorrectAnswer(e.target.value)}
                      className="mt-1 w-full h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white"
                    >
                      {answerLetters.slice(0, options.length || 4).map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={correctAnswer}
                      onChange={(e) => setCorrectAnswer(e.target.value)}
                      placeholder="정답 입력..."
                      className="mt-1 w-full h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  )
                ) : (
                  <p className="mt-1 text-sm font-bold text-green-700">{correctAnswer || '-'}</p>
                )}
              </div>
            )}
            <div className={isEssay ? 'col-span-2' : ''}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">난이도</label>
              {mode === 'edit' ? (
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="mt-1 w-full h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white"
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Lv{i + 1}</option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm font-medium text-gray-700">Lv{difficulty}</p>
              )}
            </div>
          </div>

          {/* 해설 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">해설</label>
            {mode === 'edit' ? (
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{explanation || '-'}</p>
            )}
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500">
            <div>
              <span className="text-gray-400">품질 점수</span>
              <p className="font-medium text-gray-700 mt-0.5">
                {question.qualityScore !== null ? question.qualityScore.toFixed(2) : '-'}
              </p>
            </div>
            <div>
              <span className="text-gray-400">사용 횟수</span>
              <p className="font-medium text-gray-700 mt-0.5">{question.usageCount}회</p>
            </div>
            <div>
              <span className="text-gray-400">정답률</span>
              <p className="font-medium text-gray-700 mt-0.5">
                {question.correctRate !== null ? `${(question.correctRate * 100).toFixed(1)}%` : '-'}
              </p>
            </div>
          </div>

          {/* 저장 버튼 */}
          {mode === 'edit' && (
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
              {saveError && <p className="text-xs text-red-500 mr-auto">{saveError}</p>}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode('view')}
                disabled={saving}
              >
                취소
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : '저장'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

type Props = {
  initialQuestions: AdminQuestionRow[]
}

export default function AdminQuestionTable({ initialQuestions }: Props) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterQuality, setFilterQuality] = useState('')
  const [editTarget, setEditTarget] = useState<AdminQuestionRow | null>(null)
  const [pending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, startBulkDelete] = useTransition()
  const [bulkError, setBulkError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (filterDomain && q.domain !== filterDomain) return false
      if (filterDifficulty && q.difficulty !== Number(filterDifficulty)) return false
      if (filterSource && q.source !== filterSource) return false
      if (filterQuality === 'high' && (q.qualityScore === null || q.qualityScore < 0.7)) return false
      if (filterQuality === 'mid' && (q.qualityScore === null || q.qualityScore < 0.4 || q.qualityScore >= 0.7)) return false
      if (filterQuality === 'low' && (q.qualityScore === null || q.qualityScore >= 0.4)) return false
      if (search) {
        const s = search.toLowerCase()
        if (!q.questionText.toLowerCase().includes(s) && !q.id.includes(s)) return false
      }
      return true
    })
  }, [questions, search, filterDomain, filterDifficulty, filterSource, filterQuality])

  function handleDeactivate(id: string) {
    setActionId(id)
    startTransition(async () => {
      const res = await deactivateQuestion(id)
      if (!res.error) {
        setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, isActive: false } : q)))
      }
      setActionId(null)
    })
  }

  function handleActivate(id: string) {
    setActionId(id)
    startTransition(async () => {
      const res = await activateQuestion(id)
      if (!res.error) {
        setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, isActive: true } : q)))
      }
      setActionId(null)
    })
  }

  function handleAdjustDifficulty(id: string, current: number) {
    const input = window.prompt(`새 난이도를 입력하세요 (1~10)\n현재: ${current}`)
    if (!input) return
    const newDiff = Number(input)
    if (!newDiff || newDiff < 1 || newDiff > 10) return

    setActionId(id)
    startTransition(async () => {
      const res = await adjustDifficulty(id, newDiff)
      if (!res.error) {
        setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, difficulty: newDiff } : q)))
      }
      setActionId(null)
    })
  }

  function handleSaved(updated: AdminQuestionRow) {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((q) => selected.has(q.id))

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((q) => next.delete(q.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((q) => next.add(q.id))
        return next
      })
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleBulkDelete() {
    setBulkError('')
    const ids = Array.from(selected)
    startBulkDelete(async () => {
      const res = await bulkDeleteQuestions(ids)
      if (res.error) {
        setBulkError(res.error)
      } else {
        setQuestions((prev) => prev.filter((q) => !ids.includes(q.id)))
        setSelected(new Set())
      }
      setShowDeleteConfirm(false)
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* 필터 바 */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="문제 검색..."
            className="pl-8 h-9 text-sm"
          />
        </div>

        <select
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white"
        >
          <option value="">전체 영역</option>
          {Object.entries(DOMAIN_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filterDifficulty}
          onChange={(e) => setFilterDifficulty(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white"
        >
          <option value="">전체 난이도</option>
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i + 1} value={i + 1}>Lv{i + 1}</option>
          ))}
        </select>

        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white"
        >
          <option value="">전체 출처</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filterQuality}
          onChange={(e) => setFilterQuality(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white"
        >
          <option value="">전체 품질</option>
          <option value="high">높음 (0.7+)</option>
          <option value="mid">보통 (0.4~0.7)</option>
          <option value="low">낮음 (&lt;0.4)</option>
        </select>

        <span className="text-xs text-gray-400 ml-auto">{filtered.length}개</span>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
            <span className="text-xs font-medium text-gray-700">{selected.size}개 선택됨</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setBulkError(''); setShowDeleteConfirm(true) }}
              className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <Trash2 size={12} className="mr-1" />
              일괄삭제
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              선택 해제
            </button>
          </div>
        )}
        {bulkError && <p className="text-xs text-red-500">{bulkError}</p>}
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 accent-primary-700 cursor-pointer"
                />
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">영역</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">난이도</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-0 min-w-[200px]">문제</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">출처</th>
              <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">품질</th>
              <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">사용</th>
              <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">정답률</th>
              <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-sm text-gray-400">
                  문제가 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((q) => {
              const isLoading = actionId === q.id && pending
              return (
                <tr
                  key={q.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!q.isActive ? 'opacity-50' : ''} ${selected.has(q.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selected.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      className="w-4 h-4 rounded border-gray-300 accent-primary-700 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ background: DOMAIN_COLOR[q.domain] }}
                      >
                        {DOMAIN_LABEL[q.domain]}
                      </span>
                      {q.domain === 'LISTENING' && q.audioUrl && (
                        <span title="오디오 있음"><Volume2 size={12} className="text-green-500" /></span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs font-medium text-gray-700">
                    <button
                      onClick={() => handleAdjustDifficulty(q.id, q.difficulty)}
                      className="flex items-center gap-0.5 hover:text-primary-700"
                      title="클릭하여 난이도 조정"
                    >
                      Lv{q.difficulty}
                      <ChevronDown size={10} />
                    </button>
                  </td>
                  <td className="py-3 px-3 max-w-[240px]">
                    <button
                      onClick={() => setEditTarget(q)}
                      className="text-sm text-gray-700 hover:text-primary-700 text-left line-clamp-2"
                    >
                      {q.questionText}
                    </button>
                  </td>
                  <td className="py-3 px-3">
                    <SourceBadge source={q.source} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <QualityStars score={q.qualityScore} />
                  </td>
                  <td className="py-3 px-3 text-center text-xs text-gray-500">{q.usageCount}</td>
                  <td className="py-3 px-3 text-center text-xs">
                    {q.correctRate !== null ? (
                      <span
                        className={
                          q.correctRate >= 0.7
                            ? 'text-green-600'
                            : q.correctRate >= 0.3
                            ? 'text-gray-600'
                            : 'text-red-500'
                        }
                      >
                        {(q.correctRate * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        q.isActive
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {q.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setEditTarget(q)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="상세보기/수정"
                      >
                        <Eye size={14} />
                      </button>
                      {isLoading ? (
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      ) : q.isActive ? (
                        <button
                          onClick={() => handleDeactivate(q.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                          title="비활성화"
                        >
                          <EyeOff size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(q.id)}
                          className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600"
                          title="활성화"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <EditModal
          question={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => !bulkDeleting && setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 w-full max-w-sm p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">문제 일괄 삭제</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  선택한 <span className="font-medium text-red-600">{selected.size}개</span> 문제를 영구 삭제합니다.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 mb-5">
              삭제된 문제는 복구할 수 없으며, 해당 문제가 포함된 테스트 기록에는 영향을 주지 않습니다.
            </p>
            {bulkError && <p className="text-xs text-red-500 mb-3">{bulkError}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={bulkDeleting}
              >
                취소
              </Button>
              <Button
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {bulkDeleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  `${selected.size}개 삭제`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
