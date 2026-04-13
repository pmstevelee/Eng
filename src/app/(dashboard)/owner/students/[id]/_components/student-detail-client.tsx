'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  updateStudentClass,
  updateStudentStatus,
  updateStudentLevel,
  removeStudentFromAcademy,
} from '../../actions'

type StudentData = {
  id: string
  name: string
  email: string
  currentLevel: number
  status: 'ACTIVE' | 'ON_LEAVE' | 'WITHDRAWN'
  classId: string | null
  className: string | null
  createdAt: string
  testSessions: Array<{
    id: string
    score: number | null
    grammarScore: number | null
    vocabularyScore: number | null
    readingScore: number | null
    writingScore: number | null
    listeningScore: number | null
    status: string
    startedAt: string
    completedAt: string | null
    testTitle: string
    testType: string
  }>
  radarData: {
    grammarScore: number | null
    vocabularyScore: number | null
    readingScore: number | null
    writingScore: number | null
    listeningScore: number | null
  } | null
}

type ClassOption = {
  id: string
  name: string
}

type Props = {
  student: StudentData
  classes: ClassOption[]
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '활성',
  ON_LEAVE: '휴원',
  WITHDRAWN: '퇴원',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-accent-green-light text-accent-green',
  ON_LEAVE: 'bg-accent-gold-light text-accent-gold',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
}

const TEST_TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습',
}

const SESSION_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: '미시작',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
  GRADED: '채점 완료',
}

const SESSION_STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-500',
  IN_PROGRESS: 'bg-primary-100 text-primary-700',
  COMPLETED: 'bg-accent-teal-light text-accent-teal',
  GRADED: 'bg-accent-green-light text-accent-green',
}

export default function StudentDetailClient({ student, classes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const [selectedClassId, setSelectedClassId] = useState<string>(student.classId ?? '')
  const [selectedLevel, setSelectedLevel] = useState<number>(student.currentLevel)
  const [currentStatus, setCurrentStatus] = useState(student.status)

  const handleClassSave = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateStudentClass(student.id, selectedClassId || null)
      if (res.error) setError(res.error)
    })
  }

  const handleLevelSave = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateStudentLevel(student.id, selectedLevel)
      if (res.error) setError(res.error)
    })
  }

  const handleStatusChange = (status: 'ACTIVE' | 'ON_LEAVE' | 'WITHDRAWN') => {
    setError(null)
    startTransition(async () => {
      const res = await updateStudentStatus(student.id, status)
      if (res.error) {
        setError(res.error)
      } else {
        setCurrentStatus(status)
      }
    })
  }

  const handleRemove = () => {
    setError(null)
    startTransition(async () => {
      const res = await removeStudentFromAcademy(student.id)
      if (res.error) {
        setError(res.error)
        setShowRemoveConfirm(false)
      } else {
        router.push('/owner/students')
      }
    })
  }

  const radarChartData = student.radarData
    ? [
        { subject: '문법', score: student.radarData.grammarScore ?? 0, fullMark: 100 },
        { subject: '어휘', score: student.radarData.vocabularyScore ?? 0, fullMark: 100 },
        { subject: '독해', score: student.radarData.readingScore ?? 0, fullMark: 100 },
        { subject: '쓰기', score: student.radarData.writingScore ?? 0, fullMark: 100 },
        { subject: '듣기', score: student.radarData.listeningScore ?? 0, fullMark: 100 },
      ]
    : null

  const classChanged = selectedClassId !== (student.classId ?? '')
  const levelChanged = selectedLevel !== student.currentLevel

  return (
    <div className="space-y-6">
      {/* 에러 메시지 */}
      {error && (
        <div className="bg-accent-red-light border border-accent-red rounded-xl px-4 py-3 text-sm text-accent-red">
          {error}
        </div>
      )}

      {/* 상단 프로필 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-primary-700">
                {student.name.charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{student.name}</h2>
              <p className="text-sm text-gray-500">{student.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                가입일:{' '}
                {new Date(student.createdAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLOR[currentStatus]}`}
          >
            {STATUS_LABEL[currentStatus]}
          </span>
        </div>
      </div>

      {/* 메인 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 편집 카드들 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 반 배정 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">반 배정</h3>
            <div className="flex gap-2">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700"
              >
                <option value="">미배정</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleClassSave}
                disabled={!classChanged || isPending}
                className="px-4 h-11 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                저장
              </button>
            </div>
            {!classChanged && student.className && (
              <p className="text-xs text-gray-400 mt-2">현재: {student.className}</p>
            )}
            {!classChanged && !student.className && (
              <p className="text-xs text-accent-gold mt-2">현재 미배정 상태입니다.</p>
            )}
          </div>

          {/* 레벨 수정 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">레벨</h3>
            <div className="flex gap-2">
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(parseInt(e.target.value, 10))}
                className="flex-1 h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((lv) => (
                  <option key={lv} value={lv}>
                    Level {lv}
                  </option>
                ))}
              </select>
              <button
                onClick={handleLevelSave}
                disabled={!levelChanged || isPending}
                className="px-4 h-11 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                저장
              </button>
            </div>
          </div>

          {/* 상태 변경 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">상태 변경</h3>
            <div className="flex gap-2 flex-wrap">
              {(['ACTIVE', 'ON_LEAVE', 'WITHDRAWN'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={isPending || currentStatus === s}
                  className={`flex-1 min-w-[80px] h-11 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                    currentStatus === s
                      ? s === 'ACTIVE'
                        ? 'bg-accent-green text-white opacity-100 cursor-default'
                        : s === 'ON_LEAVE'
                        ? 'bg-accent-gold text-white opacity-100 cursor-default'
                        : 'bg-gray-400 text-white opacity-100 cursor-default'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* 테스트 이력 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">테스트 이력</h3>
            </div>
            {student.testSessions.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                응시한 테스트가 없습니다.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                      테스트
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                      유형
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                      점수
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                      상태
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                      날짜
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {student.testSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium max-w-[180px] truncate">
                        {session.testTitle}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">
                          {TEST_TYPE_LABEL[session.testType] ?? session.testType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {session.score != null ? (
                          <span className="text-sm font-bold text-gray-900">{session.score}점</span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${SESSION_STATUS_COLOR[session.status] ?? 'bg-gray-100 text-gray-500'}`}
                        >
                          {SESSION_STATUS_LABEL[session.status] ?? session.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(session.startedAt).toLocaleDateString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 오른쪽: 레이더 차트 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">영역별 실력</h3>
            {radarChartData ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarChartData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                    />
                    <Radar
                      name="점수"
                      dataKey="score"
                      stroke="#1865F2"
                      fill="#1865F2"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Tooltip
                      formatter={(value) => [`${value}점`, '점수']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    { label: '문법', value: student.radarData!.grammarScore, color: '#1865F2' },
                    { label: '어휘', value: student.radarData!.vocabularyScore, color: '#7854F7' },
                    { label: '독해', value: student.radarData!.readingScore, color: '#0FBFAD' },
                    { label: '쓰기', value: student.radarData!.writingScore, color: '#E35C20' },
                    { label: '듣기', value: student.radarData!.listeningScore, color: '#F59E0B' },
                  ].map((domain) => (
                    <div key={domain.label} className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: domain.color }} />
                        <span className="text-xs text-gray-500">{domain.label}</span>
                      </div>
                      <p className="text-base font-bold" style={{ color: domain.color }}>
                        {domain.value ?? 0}점
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm text-gray-400">완료된 테스트가 없습니다.</p>
                <p className="text-xs text-gray-300 mt-1">테스트 완료 후 영역별 점수가 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 위험 구역 */}
      <div className="bg-accent-red-light border border-accent-red rounded-xl p-5">
        <h3 className="text-sm font-semibold text-accent-red mb-2">학생 제거</h3>
        <p className="text-sm text-gray-700 mb-4">
          학원에서 이 학생을 제거합니다. 학생의 계정은 유지되지만, 학원 데이터 접근이 불가능해집니다.
        </p>

        {!showRemoveConfirm ? (
          <button
            onClick={() => setShowRemoveConfirm(true)}
            className="px-4 py-2.5 rounded-xl border border-accent-red text-accent-red text-sm font-medium hover:bg-white transition-colors"
          >
            이 학생 제거
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">
              정말로 <span className="text-accent-red">{student.name}</span> 학생을 학원에서 제거하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRemove}
                disabled={isPending}
                className="px-4 py-2.5 rounded-xl bg-accent-red text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? '처리 중…' : '제거 확인'}
              </button>
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
