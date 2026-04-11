'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type PublicQuestionRow = {
  id: string
  domain: string
  subCategory: string | null
  difficulty: number
  cefrLevel: string | null
  questionType: string
  questionText: string
  source: string
  qualityScore: number | null
  usageCount: number
  createdAt: string
}

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
  LISTENING: '#E91E8A',
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

function QualityBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300 text-xs">-</span>
  const stars = score >= 0.7 ? 3 : score >= 0.4 ? 2 : 1
  const label = stars === 3 ? '높음' : stars === 2 ? '보통' : '낮음'
  const color = stars === 3 ? '#1FAF54' : stars === 2 ? '#FFB100' : '#D92916'
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${color}20`, color }}
      title={`품질 점수: ${score.toFixed(2)}`}
    >
      {'★'.repeat(stars)} {label}
    </span>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

type Props = {
  questions: PublicQuestionRow[]
}

export default function PublicQuestionList({ questions }: Props) {
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState('')
  const [filterSource, setFilterSource] = useState('')

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (filterDomain && q.domain !== filterDomain) return false
      if (filterDifficulty && q.difficulty !== Number(filterDifficulty)) return false
      if (filterSource && q.source !== filterSource) return false
      if (search) {
        const s = search.toLowerCase()
        if (!q.questionText.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [questions, search, filterDomain, filterDifficulty, filterSource])

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* 안내 배너 */}
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary-700 mt-1.5 shrink-0" />
        <p className="text-xs text-primary-700">
          공용 문제는 모든 학원에서 테스트 출제에 사용할 수 있습니다. 수정/삭제는 불가합니다.
        </p>
      </div>

      {/* 필터 */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[160px]">
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

        <span className="text-xs text-gray-400 ml-auto">{filtered.length}개</span>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">영역</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">난이도</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">문제</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">출처</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">품질</th>
              <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">사용</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                  문제가 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((q) => (
              <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ background: DOMAIN_COLOR[q.domain] }}
                  >
                    {DOMAIN_LABEL[q.domain] ?? q.domain}
                  </span>
                </td>
                <td className="py-3 px-3 text-xs font-medium text-gray-700">Lv{q.difficulty}</td>
                <td className="py-3 px-3 max-w-[280px]">
                  <p className="text-sm text-gray-700 line-clamp-2">{q.questionText}</p>
                  {q.subCategory && (
                    <p className="text-xs text-gray-400 mt-0.5">{q.subCategory}</p>
                  )}
                </td>
                <td className="py-3 px-3">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                    style={{ background: SOURCE_COLOR[q.source] ?? '#999' }}
                  >
                    {SOURCE_LABEL[q.source] ?? q.source}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <QualityBadge score={q.qualityScore} />
                </td>
                <td className="py-3 px-3 text-center text-xs text-gray-500">{q.usageCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
