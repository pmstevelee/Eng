'use client'

import { useState, useTransition } from 'react'
import { Share2, CheckCircle2, Users } from 'lucide-react'
import { shareMemberQuestionToPool } from '../actions'
import type { AdminMemberQuestionRow } from '../actions'

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

type Props = {
  questions: AdminMemberQuestionRow[]
}

export default function MemberQuestionsTab({ questions }: Props) {
  const [filterDomain, setFilterDomain] = useState('')
  const [showSharedOnly, setShowSharedOnly] = useState<'unshared' | 'all'>('unshared')
  const [localQuestions, setLocalQuestions] = useState(questions)
  const [isPending, startTransition] = useTransition()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unsharedCount = localQuestions.filter((q) => !q.isShared).length

  const filtered = localQuestions.filter((q) => {
    if (filterDomain && q.domain !== filterDomain) return false
    if (showSharedOnly === 'unshared' && q.isShared) return false
    return true
  })

  function handleShare(id: string) {
    setError(null)
    setProcessingId(id)
    startTransition(async () => {
      const res = await shareMemberQuestionToPool(id)
      setProcessingId(null)
      if (res.error) {
        setError(res.error)
        return
      }
      setLocalQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, isShared: true } : q)))
    })
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">회원 출제 문제 공유</h2>
          {unsharedCount > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-[#1865F2]">
              {unsharedCount}개 미공유
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(
              [
                { key: 'unshared', label: '미공유' },
                { key: 'all', label: '전체' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setShowSharedOnly(opt.key)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  showSharedOnly === opt.key
                    ? 'bg-[#1865F2] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-[#1865F2]"
          >
            <option value="">전체 영역</option>
            {Object.entries(DOMAIN_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        학원/교사가 직접 출제한 문제 중 품질이 검증된 문제를 공용 문제 풀로 전환할 수 있습니다.
        공유된 문제는 사본이 생성되며 원본 문제는 해당 학원 전용으로 그대로 유지됩니다.
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#D92916]">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            {showSharedOnly === 'unshared' ? '공유 대기 중인 회원 출제 문제가 없습니다.' : '회원 출제 문제가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">문제</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">영역</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-16">난이도</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-32">학원</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">출제자</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-20">사용/정답률</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-28">작성일</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 max-w-xs">
                    <p className="truncate">{q.questionText}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: DOMAIN_COLOR[q.domain] }}
                    >
                      {DOMAIN_LABEL[q.domain]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">Lv.{q.difficulty}</td>
                  <td className="px-4 py-3 text-gray-600 truncate">{q.academyName}</td>
                  <td className="px-4 py-3 text-gray-600 truncate">{q.creatorName ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {q.usageCount}회
                    {q.correctRate !== null && ` · ${Math.round(q.correctRate * 100)}%`}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(q.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    {q.isShared ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-[#1FAF54]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        공유됨
                      </span>
                    ) : (
                      <button
                        onClick={() => handleShare(q.id)}
                        disabled={isPending && processingId === q.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1865F2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1554d1] disabled:opacity-60"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        공용문제로 전환
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
