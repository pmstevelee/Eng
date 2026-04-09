'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  LayoutGrid,
  List,
  Search,
  MessageSquare,
  Users,
  CheckCheck,
  AlertTriangle,
  Star,
  TrendingUp,
  ChevronRight,
} from 'lucide-react'
import { saveBulkTeacherComment, bulkCheckAttendance } from './actions'

type ClassItem = { id: string; name: string; levelRange: string | null }

type SessionSummary = {
  id: string
  score: number | null
  grammarScore: number | null
  vocabularyScore: number | null
  readingScore: number | null
  listeningScore: number | null
  writingScore: number | null
  completedAt: string | null
}

type StudentItem = {
  id: string
  currentLevel: number
  user: { name: string; email: string }
  class: { id: string; name: string } | null
  testSessions: SessionSummary[]
  attendanceRate: number | null
}

type Status = 'warning' | 'excellent' | 'normal'

const DOMAIN_COLORS = {
  grammar: '#1865F2',
  vocabulary: '#7854F7',
  reading: '#0FBFAD',
  listening: '#E91E8A',
  writing: '#E35C20',
}

function getStatus(sessions: SessionSummary[]): Status {
  if (sessions.length === 0) return 'normal'
  const latest = sessions[0]
  if (latest.score === null) return 'normal'
  if (latest.score >= 85) return 'excellent'
  if (sessions.length >= 2 && sessions[1].score !== null) {
    if (sessions[1].score - latest.score > 10) return 'warning'
  }
  return 'normal'
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'warning')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#D92916] bg-red-50 rounded-full px-2 py-0.5">
        <AlertTriangle size={11} />
        주의 필요
      </span>
    )
  if (status === 'excellent')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#B8860B] bg-yellow-50 rounded-full px-2 py-0.5">
        <Star size={11} />
        우수
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1FAF54] bg-green-50 rounded-full px-2 py-0.5">
      <TrendingUp size={11} />
      순조로움
    </span>
  )
}

function MiniBar({ value, color }: { value: number | null; color: string }) {
  const pct = value ?? 0
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

function StudentCard({
  student,
  selected,
  onToggle,
}: {
  student: StudentItem
  selected: boolean
  onToggle: (id: string) => void
}) {
  const status = getStatus(student.testSessions)
  const latest = student.testSessions[0]
  const domains = [
    { key: 'grammar', label: '문법', value: latest?.grammarScore, color: DOMAIN_COLORS.grammar },
    { key: 'vocabulary', label: '어휘', value: latest?.vocabularyScore, color: DOMAIN_COLORS.vocabulary },
    { key: 'reading', label: '읽기', value: latest?.readingScore, color: DOMAIN_COLORS.reading },
    ...(latest?.listeningScore != null ? [{ key: 'listening', label: '듣기', value: latest.listeningScore, color: DOMAIN_COLORS.listening }] : []),
    { key: 'writing', label: '쓰기', value: latest?.writingScore, color: DOMAIN_COLORS.writing },
  ]

  return (
    <div
      className={`relative rounded-xl border bg-white p-4 transition-all cursor-pointer hover:shadow-sm ${
        selected ? 'border-primary-700 ring-1 ring-primary-700/20' : 'border-gray-200'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.preventDefault()
          onToggle(student.id)
        }}
        className="absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
        style={{
          borderColor: selected ? '#1865F2' : '#D1D5DB',
          backgroundColor: selected ? '#1865F2' : 'white',
        }}
      >
        {selected && <CheckCheck size={11} color="white" />}
      </button>

      <Link href={`/teacher/students/${student.id}`} className="block">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#1865F2]/10 flex items-center justify-center text-[#1865F2] font-bold text-base flex-shrink-0">
            {student.user.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{student.user.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-white bg-[#1865F2] rounded-full px-2 py-0.5 font-medium">
                Lv.{student.currentLevel}
              </span>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>

        {/* Latest score */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">최근 점수</span>
          <span className="text-sm font-bold text-gray-900">
            {latest?.score != null ? `${latest.score}점` : '없음'}
          </span>
        </div>

        {/* Domain mini bars */}
        <div className="space-y-1.5">
          {domains.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-6 flex-shrink-0">{d.label}</span>
              <MiniBar value={d.value} color={d.color} />
              <span className="text-[10px] text-gray-500 w-6 text-right flex-shrink-0">
                {d.value ?? '-'}
              </span>
            </div>
          ))}
        </div>

        {/* Attendance */}
        {student.attendanceRate !== null && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400">이번 달 출석률</span>
            <span
              className="text-xs font-semibold"
              style={{ color: student.attendanceRate >= 80 ? '#1FAF54' : '#D92916' }}
            >
              {student.attendanceRate}%
            </span>
          </div>
        )}
      </Link>
    </div>
  )
}

function StudentsTable({
  students,
  selectedIds,
  onToggle,
}: {
  students: StudentItem[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
}) {
  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id))
  const hasListening = students.some((s) => s.testSessions[0]?.listeningScore != null)

  const toggleAll = () => {
    if (allSelected) {
      students.forEach((s) => onToggle(s.id))
    } else {
      students.filter((s) => !selectedIds.has(s.id)).forEach((s) => onToggle(s.id))
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-3 text-left">
              <button
                onClick={toggleAll}
                className="w-4 h-4 rounded border-2 flex items-center justify-center"
                style={{
                  borderColor: allSelected ? '#1865F2' : '#D1D5DB',
                  backgroundColor: allSelected ? '#1865F2' : 'white',
                }}
              >
                {allSelected && <CheckCheck size={9} color="white" />}
              </button>
            </th>
            {['이름', '레벨', '최근점수', '문법', '어휘', '읽기', ...(hasListening ? ['듣기'] : []), '쓰기', '출석률', '상태', ''].map((h) => (
              <th
                key={h}
                className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50 first:rounded-tl-lg last:rounded-tr-lg"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {students.map((student) => {
            const status = getStatus(student.testSessions)
            const latest = student.testSessions[0]
            const isSelected = selectedIds.has(student.id)

            return (
              <tr
                key={student.id}
                className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => onToggle(student.id)}
                    className="w-4 h-4 rounded border-2 flex items-center justify-center"
                    style={{
                      borderColor: isSelected ? '#1865F2' : '#D1D5DB',
                      backgroundColor: isSelected ? '#1865F2' : 'white',
                    }}
                  >
                    {isSelected && <CheckCheck size={9} color="white" />}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#1865F2]/10 flex items-center justify-center text-[#1865F2] font-semibold text-xs">
                      {student.user.name.charAt(0)}
                    </div>
                    <span className="font-medium text-gray-900">{student.user.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs font-medium text-[#1865F2] bg-blue-50 rounded-full px-2 py-0.5">
                    Lv.{student.currentLevel}
                  </span>
                </td>
                <td className="px-3 py-3 font-medium text-gray-900">
                  {latest?.score != null ? `${latest.score}점` : '-'}
                </td>
                <td className="px-3 py-3 text-gray-600">{latest?.grammarScore ?? '-'}</td>
                <td className="px-3 py-3 text-gray-600">{latest?.vocabularyScore ?? '-'}</td>
                <td className="px-3 py-3 text-gray-600">{latest?.readingScore ?? '-'}</td>
                {hasListening && <td className="px-3 py-3 text-gray-600">{latest?.listeningScore ?? '-'}</td>}
                <td className="px-3 py-3 text-gray-600">{latest?.writingScore ?? '-'}</td>
                <td className="px-3 py-3">
                  {student.attendanceRate !== null ? (
                    <span
                      className="text-sm font-medium"
                      style={{ color: student.attendanceRate >= 80 ? '#1FAF54' : '#D92916' }}
                    >
                      {student.attendanceRate}%
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={status} />
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/teacher/students/${student.id}`}
                    className="inline-flex items-center gap-1 text-xs text-[#1865F2] hover:text-blue-800 font-medium"
                  >
                    상세
                    <ChevronRight size={12} />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BulkCommentDialog({
  studentIds,
  onClose,
}: {
  studentIds: string[]
  onClose: () => void
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setError('')
    startTransition(async () => {
      const result = await saveBulkTeacherComment({ studentIds, content, month })
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          일괄 코멘트 작성 ({studentIds.length}명)
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">대상 월</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1865F2]/20 focus:border-[#1865F2]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">코멘트</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={300}
              rows={4}
              placeholder="300자 이내로 작성해주세요..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1865F2]/20 focus:border-[#1865F2]"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{content.length}/300</p>
          </div>

          {error && <p className="text-xs text-[#D92916]">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || content.trim().length === 0}
            className="flex-1 h-11 rounded-xl bg-[#1865F2] text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function StudentsClient({
  classes,
  students,
  teacherId: _teacherId,
}: {
  classes: ClassItem[]
  students: StudentItem[]
  teacherId: string
}) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    classes.length > 0 ? classes[0].id : null
  )
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [isPending, startTransition] = useTransition()

  const filteredStudents = students.filter((s) => {
    const matchesClass = selectedClassId ? s.class?.id === selectedClassId : true
    const matchesSearch = s.user.name.toLowerCase().includes(search.toLowerCase())
    return matchesClass && matchesSearch
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkAttendance = () => {
    if (!selectedClassId) return
    const today = new Date().toISOString().split('T')[0]
    startTransition(async () => {
      await bulkCheckAttendance({
        classId: selectedClassId,
        studentIds: Array.from(selectedIds),
        date: today,
      })
      setSelectedIds(new Set())
    })
  }

  const selectedStudentIds = Array.from(selectedIds)

  const warningCount = filteredStudents.filter((s) => getStatus(s.testSessions) === 'warning').length
  const excellentCount = filteredStudents.filter((s) => getStatus(s.testSessions) === 'excellent').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">학생 학습관리</h1>
        <p className="text-sm text-gray-500 mt-1">담당 학생의 성적, 학습 경로, 출석을 관리합니다</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Users size={15} className="text-[#1865F2]" />
            <span className="text-xs text-gray-500">전체 학생</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{filteredStudents.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={15} className="text-[#D92916]" />
            <span className="text-xs text-gray-500">주의 필요</span>
          </div>
          <p className="text-2xl font-bold text-[#D92916]">{warningCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Star size={15} className="text-[#FFB100]" />
            <span className="text-xs text-gray-500">우수 학생</span>
          </div>
          <p className="text-2xl font-bold text-[#FFB100]">{excellentCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={15} className="text-[#1FAF54]" />
            <span className="text-xs text-gray-500">순조로움</span>
          </div>
          <p className="text-2xl font-bold text-[#1FAF54]">
            {filteredStudents.length - warningCount - excellentCount}
          </p>
        </div>
      </div>

      {/* Class Tabs */}
      {classes.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                selectedClassId === cls.id
                  ? 'bg-[#1865F2] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cls.name}
              {cls.levelRange && (
                <span className="ml-1.5 text-xs opacity-70">{cls.levelRange}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="학생 이름 검색..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1865F2]/20 focus:border-[#1865F2] bg-white"
          />
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'card' ? 'bg-white shadow-sm text-[#1865F2]' : 'text-gray-500'
            }`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'table' ? 'bg-white shadow-sm text-[#1865F2]' : 'text-gray-500'
            }`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#1865F2]/5 rounded-xl border border-[#1865F2]/20">
          <span className="text-sm font-medium text-[#1865F2]">{selectedIds.size}명 선택됨</span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleBulkAttendance}
              disabled={isPending || !selectedClassId}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#1FAF54] text-white text-xs font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              <CheckCheck size={13} />
              오늘 출석 일괄 처리
            </button>
            <button
              onClick={() => setShowBulkDialog(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#1865F2] text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <MessageSquare size={13} />
              일괄 코멘트 작성
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="h-9 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              선택 해제
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {filteredStudents.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-gray-200 bg-white">
          <Users size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">
            {search ? '검색 결과가 없습니다' : '배정된 학생이 없습니다'}
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStudents.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              selected={selectedIds.has(student.id)}
              onToggle={toggleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <StudentsTable
            students={filteredStudents}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
          />
        </div>
      )}

      {/* Bulk Comment Dialog */}
      {showBulkDialog && (
        <BulkCommentDialog
          studentIds={selectedStudentIds}
          onClose={() => setShowBulkDialog(false)}
        />
      )}
    </div>
  )
}
