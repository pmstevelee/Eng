'use client'

import { useState, useTransition, useMemo } from 'react'
import { Search, ChevronDown, Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deactivateQuestion, activateQuestion, adjustDifficulty } from '../actions'
import type { AdminQuestionRow } from '../actions'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
}

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}

const SOURCE_LABEL: Record<string, string> = {
  SYSTEM: '시스템',
  AI_GENERATED: 'AI 생성',
  AI_SHARED: 'AI 공유',
  TEACHER_CREATED: '교사 출제',
}

const SOURCE_COLOR: Record<string, string> = {
  SYSTEM: '#1865F2',
  AI_GENERATED: '#7854F7',
  AI_SHARED: '#0FBFAD',
  TEACHER_CREATED: '#E35C20',
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

// ── 미리보기 모달 ─────────────────────────────────────────────────────────────

function PreviewModal({ question, onClose }: { question: AdminQuestionRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg w-full shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ background: DOMAIN_COLOR[question.domain] }}
            >
              {DOMAIN_LABEL[question.domain]}
            </span>
            <span className="text-xs text-gray-500">Lv{question.difficulty}</span>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{ background: SOURCE_COLOR[question.source] }}
            >
              {SOURCE_LABEL[question.source]}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <p className="text-sm font-medium text-gray-900 mb-4">{question.questionText}</p>

        <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 border-t border-gray-100 pt-4">
          <div>
            <span className="text-gray-400">유형</span>
            <p className="font-medium text-gray-700 mt-0.5">{question.questionType}</p>
          </div>
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
  const [preview, setPreview] = useState<AdminQuestionRow | null>(null)
  const [pending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)

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
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
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
                <td colSpan={9} className="py-12 text-center text-sm text-gray-400">
                  문제가 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((q) => {
              const isLoading = actionId === q.id && pending
              return (
                <tr
                  key={q.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!q.isActive ? 'opacity-50' : ''}`}
                >
                  <td className="py-3 px-4">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ background: DOMAIN_COLOR[q.domain] }}
                    >
                      {DOMAIN_LABEL[q.domain]}
                    </span>
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
                      onClick={() => setPreview(q)}
                      className="text-sm text-gray-700 hover:text-primary-700 text-left line-clamp-2"
                    >
                      {q.questionText}
                    </button>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ background: SOURCE_COLOR[q.source] ?? '#999' }}
                    >
                      {SOURCE_LABEL[q.source] ?? q.source}
                    </span>
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
                        onClick={() => setPreview(q)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="미리보기"
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

      {preview && <PreviewModal question={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
