'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  Users,
  UserPlus,
  ArrowRightLeft,
  UserMinus,
  AlertCircle,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  BarChart,
  Bar,
} from 'recharts'
import {
  addStudentToClass,
  moveStudentToClass,
  removeStudentFromClass,
} from '../../actions'
import type { ScheduleData } from '../../actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassItem = {
  id: string
  name: string
  levelRange: string | null
  isActive: boolean
  schedule: ScheduleData | null
  teacher: { id: string; name: string } | null
}

type Student = {
  id: string
  name: string
  level: number
  lastScore: number | null
  avgScore: number | null
  attendanceRate: number | null
}

type Props = {
  classItem: ClassItem
  students: Student[]
  monthlyScores: Array<{ month: string; avg: number }>
  domainAvg: { grammar: number; vocabulary: number; reading: number; writing: number }
  studentScoreDistribution: Array<{ name: string; avg: number }>
  allClasses: Array<{ id: string; name: string }>
  unassignedStudents: Array<{ id: string; name: string; level: number }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS = ['월', '화', '수', '목', '금', '토']

function formatMonth(m: string): string {
  const [year, month] = m.split('-')
  return `${year.slice(2)}/${month}`
}

// ─── Add Student Modal ────────────────────────────────────────────────────────

function AddStudentModal({
  classId,
  unassignedStudents,
  onClose,
  onAdded,
}: {
  classId: string
  unassignedStudents: Props['unassignedStudents']
  onClose: () => void
  onAdded: (student: { id: string; name: string; level: number }) => void
}) {
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const filtered = unassignedStudents.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleAdd = (student: { id: string; name: string; level: number }) => {
    startTransition(async () => {
      const result = await addStudentToClass(student.id, classId)
      if (result.error) {
        setError(result.error)
      } else {
        onAdded(student)
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-sm w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">학생 추가</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="학생 이름 검색"
            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {error && <p className="text-sm text-accent-red mb-2">{error}</p>}
          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-400">미배정 학생이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">Level {s.level}</p>
                  </div>
                  <button
                    onClick={() => handleAdd(s)}
                    disabled={isPending}
                    className="h-8 px-3 rounded-lg bg-primary-700 text-white text-xs font-semibold hover:bg-primary-800 transition-colors disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Move Student Modal ───────────────────────────────────────────────────────

function MoveStudentModal({
  student,
  classId,
  allClasses,
  onClose,
  onMoved,
}: {
  student: Student
  classId: string
  allClasses: Props['allClasses']
  onClose: () => void
  onMoved: () => void
}) {
  const [targetClassId, setTargetClassId] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleMove = () => {
    if (!targetClassId) return
    startTransition(async () => {
      const result = await moveStudentToClass(student.id, classId, targetClassId)
      if (result.error) {
        setError(result.error)
      } else {
        onMoved()
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-sm w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">반 이동</h2>
        <p className="text-sm text-gray-500 mb-4">
          <span className="font-medium text-gray-900">{student.name}</span>을(를) 이동할 반을
          선택하세요.
        </p>

        {allClasses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">이동 가능한 반이 없습니다.</p>
        ) : (
          <select
            value={targetClassId}
            onChange={(e) => setTargetClassId(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700 mb-4"
          >
            <option value="">반 선택</option>
            {allClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {error && <p className="text-sm text-accent-red mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleMove}
            disabled={isPending || !targetClassId}
            className="flex-1 h-11 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            {isPending ? '이동 중...' : '이동'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 1: Students ──────────────────────────────────────────────────────────

function StudentsTab({
  classId,
  initialStudents,
  allClasses,
  unassignedStudents,
}: {
  classId: string
  initialStudents: Student[]
  allClasses: Props['allClasses']
  unassignedStudents: Props['unassignedStudents']
}) {
  const [students, setStudents] = useState(initialStudents)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [movingStudent, setMovingStudent] = useState<Student | null>(null)
  const [, startTransition] = useTransition()

  const handleRemove = (student: Student) => {
    if (!confirm(`${student.name}을(를) 이 반에서 제거하시겠습니까?`)) return
    startTransition(async () => {
      await removeStudentFromClass(student.id, classId)
      setStudents((prev) => prev.filter((s) => s.id !== student.id))
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          총 <span className="font-medium text-gray-900">{students.length}</span>명
        </p>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 h-9 px-3 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 transition-colors"
        >
          <UserPlus size={14} />
          학생 추가
        </button>
      </div>

      {students.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <Users size={24} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">이 반에 소속된 학생이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  학생
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  레벨
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  최근 점수
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  출석률
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-primary-700">
                          {s.name.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center text-xs font-semibold text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                      Level {s.level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {s.lastScore !== null ? `${s.lastScore}점` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {s.attendanceRate !== null ? (
                      <span
                        className={`text-sm font-medium ${
                          s.attendanceRate >= 80
                            ? 'text-accent-green'
                            : s.attendanceRate >= 60
                              ? 'text-accent-gold'
                              : 'text-accent-red'
                        }`}
                      >
                        {s.attendanceRate}%
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setMovingStudent(s)}
                        className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <ArrowRightLeft size={12} />
                        반 이동
                      </button>
                      <button
                        onClick={() => handleRemove(s)}
                        className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-gray-200 text-xs text-accent-red hover:bg-accent-red-light transition-colors"
                      >
                        <UserMinus size={12} />
                        제거
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addModalOpen && (
        <AddStudentModal
          classId={classId}
          unassignedStudents={unassignedStudents}
          onClose={() => setAddModalOpen(false)}
          onAdded={(student) => {
            setStudents((prev) => [
              ...prev,
              {
                id: student.id,
                name: student.name,
                level: student.level,
                lastScore: null,
                avgScore: null,
                attendanceRate: null,
              },
            ])
          }}
        />
      )}

      {movingStudent && (
        <MoveStudentModal
          student={movingStudent}
          classId={classId}
          allClasses={allClasses}
          onClose={() => setMovingStudent(null)}
          onMoved={() => {
            setStudents((prev) => prev.filter((s) => s.id !== movingStudent.id))
            setMovingStudent(null)
          }}
        />
      )}
    </>
  )
}

// ─── Tab 2: Stats ─────────────────────────────────────────────────────────────

function StatsTab({
  monthlyScores,
  domainAvg,
  studentScoreDistribution,
}: {
  monthlyScores: Props['monthlyScores']
  domainAvg: Props['domainAvg']
  studentScoreDistribution: Props['studentScoreDistribution']
}) {
  const radarData = [
    { domain: '문법', value: domainAvg.grammar, fullMark: 100 },
    { domain: '어휘', value: domainAvg.vocabulary, fullMark: 100 },
    { domain: '읽기', value: domainAvg.reading, fullMark: 100 },
    { domain: '쓰기', value: domainAvg.writing, fullMark: 100 },
  ]

  const hasMonthly = monthlyScores.length > 0
  const hasDomain = Object.values(domainAvg).some((v) => v > 0)
  const hasDistribution = studentScoreDistribution.length > 0

  return (
    <div className="space-y-6">
      {/* 반 평균 점수 추이 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">반 평균 점수 추이 (최근 6개월)</h3>
        {hasMonthly ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyScores.map((m) => ({ ...m, month: formatMonth(m.month) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B6F7A' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B6F7A' }} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #E3E5EA',
                  fontSize: 12,
                }}
                formatter={(v) => [`${v}점`, '평균']}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#1865F2"
                strokeWidth={2}
                dot={{ r: 4, fill: '#1865F2' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="점수 데이터가 없습니다." />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 영역별 반 평균 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">영역별 반 평균</h3>
          {hasDomain ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E3E5EA" />
                <PolarAngleAxis dataKey="domain" tick={{ fontSize: 12, fill: '#6B6F7A' }} />
                <Radar
                  dataKey="value"
                  stroke="#7854F7"
                  fill="#7854F7"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E3E5EA', fontSize: 12 }}
                  formatter={(v) => [`${v}점`]}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="영역별 데이터가 없습니다." />
          )}
        </div>

        {/* 학생별 점수 분포 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">학생별 평균 점수</h3>
          {hasDistribution ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={studentScoreDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EA" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B6F7A' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6B6F7A' }}
                  width={60}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E3E5EA', fontSize: 12 }}
                  formatter={(v) => [`${v}점`, '평균']}
                />
                <Bar dataKey="avg" fill="#1865F2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="학생 점수 데이터가 없습니다." />
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-2">
      <AlertCircle size={24} className="text-gray-300" />
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

// ─── Tab 3: Schedule ──────────────────────────────────────────────────────────

function ScheduleTab({
  schedule,
  teacher,
}: {
  schedule: ScheduleData | null
  teacher: ClassItem['teacher']
}) {
  if (!schedule || !schedule.days?.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-16 flex flex-col items-center gap-3">
        <AlertCircle size={24} className="text-gray-300" />
        <p className="text-sm text-gray-400">시간표가 설정되지 않았습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 주간 시간표 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">주간 시간표</h3>
        </div>

        <div className="grid grid-cols-6 border-b border-gray-100">
          {DAYS.map((day) => (
            <div
              key={day}
              className={`text-center py-2.5 text-sm font-medium border-r border-gray-100 last:border-r-0 ${
                schedule.days.includes(day)
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-300 bg-gray-50'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-6">
          {DAYS.map((day) => (
            <div
              key={day}
              className={`border-r border-gray-100 last:border-r-0 min-h-[80px] flex items-center justify-center ${
                schedule.days.includes(day) ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              {schedule.days.includes(day) ? (
                <div className="text-center p-2">
                  <p className="text-sm font-semibold text-primary-700">
                    {schedule.startTime}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">~</p>
                  <p className="text-sm font-semibold text-primary-700">{schedule.endTime}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* 수업 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">수업 정보</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">수업 요일</p>
            <p className="text-sm font-medium text-gray-900">
              {schedule.days.length > 0 ? schedule.days.join(', ') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">수업 시간</p>
            <p className="text-sm font-medium text-gray-900">
              {schedule.startTime} – {schedule.endTime}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">교실</p>
            <p className="text-sm font-medium text-gray-900">
              {schedule.room || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">담당 교사</p>
            <p className="text-sm font-medium text-gray-900">{teacher?.name ?? '미정'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'students' | 'stats' | 'schedule'

export default function ClassDetailClient({
  classItem,
  students,
  monthlyScores,
  domainAvg,
  studentScoreDistribution,
  allClasses,
  unassignedStudents,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('students')

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'students', label: '학생 목록' },
    { id: 'stats', label: '성적 현황' },
    { id: 'schedule', label: '시간표' },
  ]

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
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{classItem.name}</h1>
            {!classItem.isActive && (
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                비활성
              </span>
            )}
            {classItem.levelRange && (
              <span className="text-xs font-semibold text-primary-700 bg-primary-100 px-2.5 py-1 rounded-full">
                {classItem.levelRange}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            담당 교사: {classItem.teacher?.name ?? '미정'}
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-700 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'students' && (
        <StudentsTab
          classId={classItem.id}
          initialStudents={students}
          allClasses={allClasses}
          unassignedStudents={unassignedStudents}
        />
      )}
      {activeTab === 'stats' && (
        <StatsTab
          monthlyScores={monthlyScores}
          domainAvg={domainAvg}
          studentScoreDistribution={studentScoreDistribution}
        />
      )}
      {activeTab === 'schedule' && (
        <ScheduleTab schedule={classItem.schedule} teacher={classItem.teacher} />
      )}
    </div>
  )
}
