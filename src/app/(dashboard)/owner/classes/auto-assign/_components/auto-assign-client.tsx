'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronLeft, Sparkles, Check, AlertCircle, Users } from 'lucide-react'
import { applyAutoAssign } from '../../actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassItem = {
  id: string
  name: string
  levelRange: string | null
}

type StudentItem = {
  id: string
  name: string
  level: number
  currentClassId: string | null
}

type Assignment = {
  studentId: string
  classId: string
}

type Props = {
  classes: ClassItem[]
  students: StudentItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLevelRange(lr: string | null): { start: number; end: number } | null {
  if (!lr) return null
  const m = lr.match(/Level\s+(\d+)(?:-(\d+))?/)
  if (!m) return null
  const start = parseInt(m[1])
  const end = m[2] ? parseInt(m[2]) : start
  return { start, end }
}

function recommend(
  students: StudentItem[],
  classes: ClassItem[],
): Map<string, string | null> {
  const map = new Map<string, string | null>()
  for (const student of students) {
    const match = classes.find((c) => {
      const range = parseLevelRange(c.levelRange)
      if (!range) return false
      return student.level >= range.start && student.level <= range.end
    })
    map.set(student.id, match?.id ?? null)
  }
  return map
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AutoAssignClient({ classes, students }: Props) {
  const [assignments, setAssignments] = useState<Map<string, string | null>>(
    () => new Map(students.map((s) => [s.id, s.currentClassId])),
  )
  const [recommended, setRecommended] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState('')

  const handleRecommend = () => {
    const map = recommend(students, classes)
    setAssignments(map)
    setRecommended(true)
    setApplied(false)
  }

  const handleChange = (studentId: string, classId: string) => {
    setAssignments((prev) => new Map(prev).set(studentId, classId || null))
  }

  const handleApply = () => {
    const toAssign: Assignment[] = []
    assignments.forEach((classId, studentId) => {
      const student = students.find((s) => s.id === studentId)
      if (!student) return
      if (classId && classId !== student.currentClassId) {
        toAssign.push({ studentId, classId })
      }
    })

    if (toAssign.length === 0) {
      setError('변경된 배정이 없습니다.')
      return
    }

    setError('')
    startTransition(async () => {
      const result = await applyAutoAssign(toAssign)
      if (result.error) {
        setError(result.error)
      } else {
        setApplied(true)
        // Update currentClassId
        students.forEach((s) => {
          const newClassId = assignments.get(s.id)
          if (newClassId !== undefined) s.currentClassId = newClassId
        })
      }
    })
  }

  const changedCount = students.filter((s) => {
    const newId = assignments.get(s.id)
    return newId && newId !== s.currentClassId
  }).length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/owner/classes"
          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">AI 반 편성 추천</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            학생의 레벨을 기반으로 최적의 반을 추천합니다.
          </p>
        </div>
      </div>

      {/* 안내 카드 */}
      <div className="bg-accent-purple-light border border-accent-purple rounded-xl px-5 py-4 flex items-start gap-3">
        <Sparkles size={18} className="text-accent-purple mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-accent-purple mb-1">AI 반 편성 추천 방법</p>
          <p className="text-sm text-gray-700">
            각 학생의 현재 레벨과 반의 레벨 범위를 비교하여 최적 반을 추천합니다.
            추천 결과를 확인한 후 개별 조정하고 일괄 적용할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 반 현황 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {classes.map((c) => {
          const count = Array.from(assignments.values()).filter((v) => v === c.id).length
          const range = parseLevelRange(c.levelRange)
          return (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
              {c.levelRange && (
                <span className="inline-flex text-xs font-medium text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full mt-1">
                  {c.levelRange}
                </span>
              )}
              <div className="flex items-center gap-1 mt-2">
                <Users size={13} className="text-gray-400" />
                <span className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{count}</span>명
                </span>
              </div>
              {range && (
                <p className="text-xs text-gray-400 mt-1">
                  Level {range.start}~{range.end} 적합
                </p>
              )}
            </div>
          )
        })}
        {classes.length === 0 && (
          <div className="col-span-4 bg-white rounded-xl border border-gray-200 py-8 text-center">
            <p className="text-sm text-gray-400">활성 반이 없습니다. 먼저 반을 생성해주세요.</p>
          </div>
        )}
      </div>

      {/* AI 추천 버튼 */}
      <div className="flex justify-center">
        <button
          onClick={handleRecommend}
          disabled={classes.length === 0}
          className="flex items-center gap-2 h-12 px-6 rounded-xl bg-accent-purple text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Sparkles size={16} />
          AI 반 편성 추천 실행
        </button>
      </div>

      {/* 학생별 배정 테이블 */}
      {students.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">학생별 반 배정</h3>
            {recommended && (
              <span className="text-xs font-medium text-accent-purple bg-accent-purple-light px-2.5 py-1 rounded-full">
                AI 추천 적용됨
              </span>
            )}
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  학생
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  현재 레벨
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  현재 반
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  배정할 반
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  변경
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((student) => {
                const currentClass = classes.find((c) => c.id === student.currentClassId)
                const assigned = assignments.get(student.id)
                const isChanged = assigned && assigned !== student.currentClassId
                const isUnmatched = recommended && !assigned

                return (
                  <tr
                    key={student.id}
                    className={`transition-colors ${
                      isChanged ? 'bg-accent-green-light' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-primary-700">
                            {student.name.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex text-xs font-semibold text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                        Level {student.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">
                        {currentClass?.name ?? '미배정'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={assigned ?? ''}
                        onChange={(e) => handleChange(student.id, e.target.value)}
                        className={`h-9 px-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-700 ${
                          isUnmatched
                            ? 'border-accent-gold bg-accent-gold-light text-accent-gold'
                            : 'border-gray-200 text-gray-900'
                        }`}
                      >
                        <option value="">미배정</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {isUnmatched && (
                        <p className="text-xs text-accent-gold mt-1">
                          적합한 반 없음
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isChanged ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-green">
                          <Check size={12} />
                          변경
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 적용 버튼 */}
      {students.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4">
          <div>
            {changedCount > 0 ? (
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-primary-700">{changedCount}명</span>의 반
                배정이 변경됩니다.
              </p>
            ) : (
              <p className="text-sm text-gray-400">변경된 배정이 없습니다.</p>
            )}
            {error && (
              <div className="flex items-center gap-1 mt-1">
                <AlertCircle size={13} className="text-accent-red" />
                <p className="text-xs text-accent-red">{error}</p>
              </div>
            )}
            {applied && (
              <div className="flex items-center gap-1 mt-1">
                <Check size={13} className="text-accent-green" />
                <p className="text-xs text-accent-green">반 배정이 완료되었습니다.</p>
              </div>
            )}
          </div>

          <button
            onClick={handleApply}
            disabled={isPending || changedCount === 0}
            className="flex items-center gap-2 h-11 px-5 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 transition-colors disabled:opacity-40"
          >
            {isPending ? '적용 중...' : `${changedCount}명 일괄 적용`}
          </button>
        </div>
      )}
    </div>
  )
}
