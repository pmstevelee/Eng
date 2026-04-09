'use client'

import { useState, useTransition } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  BarChart2,
  BookOpen,
  MessageSquare,
  Calendar,
  RefreshCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle,
  Circle,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react'
import { saveTeacherComment, updateAttendance, regenerateLearningPath, overrideStudentLevel, deployLevelTestToStudent } from '../actions'
import type { PromotionProgress } from '@/lib/assessment/promotion-engine'

// ─── Types ───────────────────────────────────────────────────────────────────

type SessionData = {
  id: string
  score: number | null
  grammarScore: number | null
  vocabularyScore: number | null
  readingScore: number | null
  listeningScore: number | null
  writingScore: number | null
  completedAt: string | null
  testTitle: string
  testType: string
}

type LearningPathData = {
  id: string
  title: string
  description: string | null
  goalsJson: unknown
  progressJson: unknown
  createdAt: string
}

type CommentData = {
  id: string
  content: string
  month: string
  teacherName: string
  createdAt: string
}

type AttendanceData = {
  id: string
  date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
  classId: string
}

type GoalsJson = {
  weaknesses: string[]
  steps: Array<{ id: string; title: string; domain: string; description: string }>
}

type ProgressJson = Record<string, { progress: number }>

type LevelAssessmentData = {
  id: string
  assessmentType: string
  grammarLevel: number
  vocabularyLevel: number
  readingLevel: number
  listeningLevel: number | null
  writingLevel: number
  overallLevel: number
  assessedAt: string
  assessedBy: string
  isCurrent: boolean
  detailJson: unknown
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOMAIN_COLORS = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  LISTENING: '#E91E8A',
  WRITING: '#E35C20',
}

const ATTENDANCE_CONFIG = {
  PRESENT: { label: '출석', color: '#1FAF54', bg: 'bg-[#1FAF54]' },
  ABSENT: { label: '결석', color: '#D92916', bg: 'bg-[#D92916]' },
  LATE: { label: '지각', color: '#FFB100', bg: 'bg-[#FFB100]' },
  EXCUSED: { label: '공결', color: '#7854F7', bg: 'bg-[#7854F7]' },
}

const STATUS_CYCLE: Array<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
]

const TEST_TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습',
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  LISTENING: '듣기',
  WRITING: '쓰기',
}

const WEEK_DAYS = ['일', '월', '화', '수', '목', '금', '토']

// ─── Tab 1: 성적 종합 ─────────────────────────────────────────────────────────

function ScoreTab({
  sessions,
  currentLevel,
}: {
  sessions: SessionData[]
  currentLevel: number
}) {
  const latest = sessions[0]

  const hasListening = sessions.some((s) => s.listeningScore != null)
  const radarData = [
    { subject: '문법', score: latest?.grammarScore ?? 0, fullMark: 100 },
    { subject: '어휘', score: latest?.vocabularyScore ?? 0, fullMark: 100 },
    { subject: '읽기', score: latest?.readingScore ?? 0, fullMark: 100 },
    ...(hasListening ? [{ subject: '듣기', score: latest?.listeningScore ?? 0, fullMark: 100 }] : []),
    { subject: '쓰기', score: latest?.writingScore ?? 0, fullMark: 100 },
  ]

  const lineData = [...sessions].reverse().map((s, i) => ({
    name: `${i + 1}회`,
    총점: s.score,
    문법: s.grammarScore,
    어휘: s.vocabularyScore,
    읽기: s.readingScore,
    ...(hasListening ? { 듣기: s.listeningScore } : {}),
    쓰기: s.writingScore,
  }))

  // Level progress: threshold to advance is 85
  const lastScore = latest?.score ?? 0
  const advanceThreshold = 85
  const progressPct = Math.min(100, Math.max(0, ((lastScore - 60) / (advanceThreshold - 60)) * 100))
  const pointsNeeded = Math.max(0, advanceThreshold - lastScore)

  if (sessions.length === 0) {
    return (
      <div className="py-20 text-center text-gray-400">
        <BarChart2 size={36} className="mx-auto mb-3 opacity-50" />
        <p className="text-sm">테스트 기록이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">영역별 점수 (최근 테스트)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E5E7EB" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <Radar
                name="점수"
                dataKey="score"
                stroke="#1865F2"
                fill="#1865F2"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Level Progress + Line Chart */}
        <div className="space-y-4">
          {/* Level progress */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">레벨 현황</h3>
              <span className="text-xs font-medium text-[#1865F2] bg-blue-50 rounded-full px-2.5 py-1">
                Level {currentLevel}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>Level {currentLevel}</span>
              <span>Level {currentLevel + 1}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1865F2] rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {pointsNeeded > 0
                ? `다음 레벨까지 ${pointsNeeded}점 필요 (기준: 85점)`
                : '다음 레벨 달성 가능!'}
            </p>
          </div>

          {/* Domain scores summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">영역별 점수</h3>
            <div className="space-y-2.5">
              {[
                { key: 'GRAMMAR', value: latest?.grammarScore },
                { key: 'VOCABULARY', value: latest?.vocabularyScore },
                { key: 'READING', value: latest?.readingScore },
                ...(hasListening ? [{ key: 'LISTENING', value: latest?.listeningScore }] : []),
                { key: 'WRITING', value: latest?.writingScore },
              ].map(({ key, value }) => (
                <div key={key} className="flex items-center gap-3">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: DOMAIN_COLORS[key as keyof typeof DOMAIN_COLORS] }}
                  />
                  <span className="text-xs text-gray-600 w-10">{DOMAIN_LABEL[key]}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${value ?? 0}%`,
                        backgroundColor: DOMAIN_COLORS[key as keyof typeof DOMAIN_COLORS],
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-8 text-right">
                    {value ?? '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Line Chart */}
      {lineData.length > 1 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">점수 추이 (최근 {lineData.length}회)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="총점" stroke="#1865F2" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="문법" stroke={DOMAIN_COLORS.GRAMMAR} strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="어휘" stroke={DOMAIN_COLORS.VOCABULARY} strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="읽기" stroke={DOMAIN_COLORS.READING} strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
              {hasListening && <Line type="monotone" dataKey="듣기" stroke={DOMAIN_COLORS.LISTENING} strokeWidth={1.5} dot={false} strokeDasharray="3 3" />}
              <Line type="monotone" dataKey="쓰기" stroke={DOMAIN_COLORS.WRITING} strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Test history table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">테스트 이력</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['날짜', '테스트명', '유형', '총점', '문법', '어휘', '읽기', ...(hasListening ? ['듣기'] : []), '쓰기'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {s.completedAt
                      ? new Date(s.completedAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })
                      : '-'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-40 truncate">
                    {s.testTitle}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                      {TEST_TYPE_LABEL[s.testType] ?? s.testType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{s.score ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.grammarScore ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.vocabularyScore ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.readingScore ?? '-'}</td>
                  {hasListening && <td className="px-4 py-3 text-gray-600">{s.listeningScore ?? '-'}</td>}
                  <td className="px-4 py-3 text-gray-600">{s.writingScore ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: 학습 경로 ─────────────────────────────────────────────────────────

function LearningPathTab({
  studentId,
  learningPath,
}: {
  studentId: string
  learningPath: LearningPathData | null
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleRegenerate = () => {
    setError('')
    startTransition(async () => {
      const result = await regenerateLearningPath(studentId)
      if (result.error) setError(result.error)
    })
  }

  const goals =
    learningPath?.goalsJson &&
    typeof learningPath.goalsJson === 'object' &&
    !Array.isArray(learningPath.goalsJson)
      ? (learningPath.goalsJson as GoalsJson)
      : null

  const progress =
    learningPath?.progressJson &&
    typeof learningPath.progressJson === 'object' &&
    !Array.isArray(learningPath.progressJson)
      ? (learningPath.progressJson as ProgressJson)
      : {}

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">AI 추천 학습 경로</h3>
          {learningPath && (
            <p className="text-xs text-gray-400 mt-0.5">
              생성일: {new Date(learningPath.createdAt).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
        <button
          onClick={handleRegenerate}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#7854F7] text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={isPending ? 'animate-spin' : ''} />
          {isPending ? '분석 중...' : '학습 경로 재생성'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-[#D92916] bg-red-50 px-3 py-2 rounded-xl">{error}</p>
      )}

      {!learningPath ? (
        <div className="py-20 text-center rounded-xl border border-gray-200 bg-white">
          <Sparkles size={36} className="mx-auto mb-3 text-[#7854F7] opacity-50" />
          <p className="text-sm font-medium text-gray-500 mb-2">학습 경로가 없습니다</p>
          <p className="text-xs text-gray-400 mb-4">AI가 테스트 결과를 분석하여 맞춤 학습 경로를 생성합니다</p>
          <button
            onClick={handleRegenerate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-[#7854F7] text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles size={14} />
            {isPending ? '생성 중...' : '학습 경로 생성'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Weaknesses */}
          {goals?.weaknesses && goals.weaknesses.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                약점 영역
              </h4>
              <div className="flex flex-wrap gap-2">
                {goals.weaknesses.map((w) => (
                  <span
                    key={w}
                    className="text-xs font-medium px-3 py-1 rounded-full text-white"
                    style={{
                      backgroundColor:
                        DOMAIN_COLORS[w.toUpperCase() as keyof typeof DOMAIN_COLORS] ?? '#6B7280',
                    }}
                  >
                    {DOMAIN_LABEL[w.toUpperCase()] ?? w}
                  </span>
                ))}
              </div>
              {learningPath.description && (
                <p className="text-xs text-gray-500 mt-2">{learningPath.description}</p>
              )}
            </div>
          )}

          {/* Steps */}
          {goals?.steps && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700">추천 학습 순서</h4>
              </div>
              <div className="divide-y divide-gray-50">
                {goals.steps.map((step, idx) => {
                  const pct = progress[step.id]?.progress ?? 0
                  const isComplete = pct >= 100
                  return (
                    <div key={step.id} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                          style={{
                            backgroundColor:
                              DOMAIN_COLORS[step.domain as keyof typeof DOMAIN_COLORS] + '20',
                            color: DOMAIN_COLORS[step.domain as keyof typeof DOMAIN_COLORS],
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">{step.title}</span>
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{
                                color: DOMAIN_COLORS[step.domain as keyof typeof DOMAIN_COLORS],
                                backgroundColor:
                                  DOMAIN_COLORS[step.domain as keyof typeof DOMAIN_COLORS] + '15',
                              }}
                            >
                              {DOMAIN_LABEL[step.domain] ?? step.domain}
                            </span>
                            {isComplete && <CheckCircle size={13} className="text-[#1FAF54]" />}
                            {!isComplete && pct === 0 && <Circle size={13} className="text-gray-300" />}
                          </div>
                          <p className="text-xs text-gray-500 mb-2">{step.description}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor:
                                    DOMAIN_COLORS[step.domain as keyof typeof DOMAIN_COLORS],
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Assign problems button */}
          <button
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-[#1865F2] text-[#1865F2] text-sm font-medium hover:bg-blue-50 transition-colors"
            onClick={() => alert('추가 문제 배정 기능은 준비 중입니다.')}
          >
            <Plus size={15} />
            추가 문제 배정
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: 교사 코멘트 ───────────────────────────────────────────────────────

function CommentTab({
  studentId,
  comments,
}: {
  studentId: string
  comments: CommentData[]
}) {
  const [showDialog, setShowDialog] = useState(false)
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
      const result = await saveTeacherComment({ studentId, content, month })
      if (result.error) {
        setError(result.error)
      } else {
        setShowDialog(false)
        setContent('')
      }
    })
  }

  // Group comments by month
  const grouped = comments.reduce<Record<string, CommentData[]>>((acc, c) => {
    const key = c.month || new Date(c.createdAt).toISOString().slice(0, 7)
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">월별 코멘트</h3>
        <button
          onClick={() => setShowDialog(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#1865F2] text-white text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={13} />
          코멘트 작성
        </button>
      </div>

      {comments.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-gray-200 bg-white">
          <MessageSquare size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">작성된 코멘트가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedMonths.map((monthKey) => {
            const [year, mon] = monthKey.split('-')
            return (
              <div key={monthKey}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-gray-500">
                    {year}년 {parseInt(mon)}월
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <div className="space-y-2">
                  {grouped[monthKey].map((comment) => (
                    <div key={comment.id} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">
                          {comment.teacherName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Comment Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowDialog(false)} />
          <div className="relative bg-white rounded-2xl shadow-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-4">코멘트 작성</h3>
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
                  rows={5}
                  placeholder="학생에 대한 코멘트를 입력해주세요..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1865F2]/20 focus:border-[#1865F2]"
                />
                <p className="text-right text-xs text-gray-400 mt-1">{content.length}/300</p>
              </div>
              {error && <p className="text-xs text-[#D92916]">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowDialog(false)}
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
      )}
    </div>
  )
}

// ─── Tab 4: 출석 ──────────────────────────────────────────────────────────────

function AttendanceTab({
  studentId,
  classId,
  attendance,
}: {
  studentId: string
  classId: string
  attendance: AttendanceData[]
}) {
  const [isPending, startTransition] = useTransition()
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  // Build lookup map
  const [optimistic, setOptimistic] = useState<Map<string, AttendanceData['status']>>(new Map())

  const getStatus = (dateStr: string): AttendanceData['status'] | null => {
    if (optimistic.has(dateStr)) return optimistic.get(dateStr)!
    const record = attendance.find((a) => a.date.split('T')[0] === dateStr)
    return record?.status ?? null
  }

  const handleDayClick = (dateStr: string) => {
    const current = getStatus(dateStr)
    const currentIdx = current ? STATUS_CYCLE.indexOf(current) : -1
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length]

    setOptimistic((prev) => new Map(prev).set(dateStr, nextStatus))

    startTransition(async () => {
      await updateAttendance({ studentId, classId, date: dateStr, status: nextStatus })
    })
  }

  // Generate calendar days
  const firstDay = new Date(currentDate.year, currentDate.month, 1)
  const lastDay = new Date(currentDate.year, currentDate.month + 1, 0)
  const startDow = firstDay.getDay()
  const totalDays = lastDay.getDate()

  // Attendance stats for current month
  const monthPrefix = `${currentDate.year}-${String(currentDate.month + 1).padStart(2, '0')}`
  const monthRecords = Array.from({ length: totalDays }, (_, i) => {
    const day = String(i + 1).padStart(2, '0')
    return getStatus(`${monthPrefix}-${day}`)
  }).filter(Boolean) as AttendanceData['status'][]

  const presentCount = monthRecords.filter((s) => s === 'PRESENT').length
  const absentCount = monthRecords.filter((s) => s === 'ABSENT').length
  const lateCount = monthRecords.filter((s) => s === 'LATE').length
  const totalRecorded = monthRecords.length
  const attendanceRate =
    totalRecorded > 0
      ? Math.round(((presentCount + lateCount) / totalRecorded) * 100)
      : null

  const prevMonth = () =>
    setCurrentDate(({ year, month }) => ({
      year: month === 0 ? year - 1 : year,
      month: month === 0 ? 11 : month - 1,
    }))

  const nextMonth = () =>
    setCurrentDate(({ year, month }) => ({
      year: month === 11 ? year + 1 : year,
      month: month === 11 ? 0 : month + 1,
    }))

  return (
    <div className="space-y-4">
      {/* Month navigation + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-base font-semibold text-gray-900 min-w-24 text-center">
            {currentDate.year}년 {currentDate.month + 1}월
          </span>
          <button
            onClick={nextMonth}
            className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {attendanceRate !== null && (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-500">
              출석률{' '}
              <span
                className="font-bold text-base"
                style={{ color: attendanceRate >= 80 ? '#1FAF54' : '#D92916' }}
              >
                {attendanceRate}%
              </span>
            </span>
            <span className="text-[#1FAF54]">출석 {presentCount}</span>
            <span className="text-[#D92916]">결석 {absentCount}</span>
            <span className="text-[#FFB100]">지각 {lateCount}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {Object.entries(ATTENDANCE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${cfg.bg}`} />
            {cfg.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-100" />
          기록없음
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        {isPending && (
          <p className="text-xs text-[#1865F2] mb-2">저장 중...</p>
        )}

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEK_DAYS.map((d, i) => (
            <div
              key={d}
              className={`text-center text-xs font-medium py-2 ${
                i === 0 ? 'text-[#D92916]' : i === 6 ? 'text-[#1865F2]' : 'text-gray-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1
            const dayStr = String(day).padStart(2, '0')
            const dateStr = `${monthPrefix}-${dayStr}`
            const status = getStatus(dateStr)
            const dow = (startDow + i) % 7
            const isToday =
              new Date().toISOString().split('T')[0] === dateStr

            return (
              <button
                key={day}
                onClick={() => classId && handleDayClick(dateStr)}
                disabled={!classId}
                className={`relative aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:opacity-80 ${
                  status
                    ? 'text-white'
                    : dow === 0
                    ? 'text-[#D92916] bg-red-50 hover:bg-red-100'
                    : dow === 6
                    ? 'text-[#1865F2] bg-blue-50 hover:bg-blue-100'
                    : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
                }`}
                style={
                  status
                    ? { backgroundColor: ATTENDANCE_CONFIG[status].color }
                    : undefined
                }
              >
                {day}
                {isToday && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current opacity-60" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {!classId && (
        <p className="text-xs text-gray-400 text-center">반이 배정되지 않아 출석 수정이 불가합니다.</p>
      )}
    </div>
  )
}

// ─── Tab 5: 레벨 관리 ─────────────────────────────────────────────────────────

const ASSESSMENT_TYPE_LABEL: Record<string, string> = {
  PLACEMENT: '입학 배치',
  PERIODIC: '정기 레벨 테스트',
  PROMOTION: '승급 판정',
  TEACHER_OVERRIDE: '교사 수동 조정',
}

const ASSESSMENT_TYPE_COLOR: Record<string, string> = {
  PLACEMENT: '#0FBFAD',
  PERIODIC: '#1865F2',
  PROMOTION: '#1FAF54',
  TEACHER_OVERRIDE: '#FFB100',
}

const DOMAIN_SHORT_KO: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  LISTENING: '듣기',
  WRITING: '쓰기',
}

function LevelTab({
  studentId,
  currentLevel,
  levelAssessments,
  promotionProgress,
}: {
  studentId: string
  currentLevel: number
  levelAssessments: LevelAssessmentData[]
  promotionProgress: PromotionProgress
}) {
  const [isPending, startTransition] = useTransition()
  const [deployPending, startDeployTransition] = useTransition()
  const [showOverrideDialog, setShowOverrideDialog] = useState(false)
  const [overrideLevel, setOverrideLevel] = useState(currentLevel)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideError, setOverrideError] = useState('')
  const [deployMsg, setDeployMsg] = useState('')

  const currentAssessment = levelAssessments.find((la) => la.isCurrent)

  const handleOverride = () => {
    if (!overrideReason.trim()) {
      setOverrideError('조정 사유를 입력해주세요.')
      return
    }
    setOverrideError('')
    startTransition(async () => {
      const result = await overrideStudentLevel({ studentId, targetLevel: overrideLevel, reason: overrideReason })
      if (result.error) {
        setOverrideError(result.error)
      } else {
        setShowOverrideDialog(false)
        setOverrideReason('')
      }
    })
  }

  const handleDeployTest = () => {
    setDeployMsg('')
    startDeployTransition(async () => {
      const result = await deployLevelTestToStudent({ studentId })
      if (result.error) {
        setDeployMsg(`오류: ${result.error}`)
      } else {
        setDeployMsg('레벨 테스트가 학생에게 배포되었습니다.')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* a) 현재 레벨 정보 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-[#1865F2]" />
            <span className="text-sm font-semibold text-gray-700">현재 레벨 정보</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDeployTest}
              disabled={deployPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#1865F2] px-3 py-1.5 text-xs font-medium text-[#1865F2] hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {deployPending ? '배포 중...' : '레벨 테스트 배포'}
            </button>
            <button
              onClick={() => setShowOverrideDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFB100] px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition-colors"
            >
              레벨 수동 변경
            </button>
          </div>
        </div>

        {deployMsg && (
          <p className={`mb-3 rounded-xl px-3 py-2 text-xs ${deployMsg.startsWith('오류') ? 'bg-red-50 text-[#D92916]' : 'bg-green-50 text-[#1FAF54]'}`}>
            {deployMsg}
          </p>
        )}

        <div className={`grid grid-cols-2 gap-4 ${currentAssessment?.listeningLevel != null ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
          <div className="text-center">
            <p className="text-xs text-gray-400">공식 레벨</p>
            <p className="mt-1 text-2xl font-black text-[#1865F2]">Lv.{currentLevel}</p>
          </div>
          {currentAssessment && (
            (
              [
                { key: 'GRAMMAR', val: currentAssessment.grammarLevel },
                { key: 'VOCABULARY', val: currentAssessment.vocabularyLevel },
                { key: 'READING', val: currentAssessment.readingLevel },
                ...(currentAssessment.listeningLevel != null
                  ? [{ key: 'LISTENING' as keyof typeof DOMAIN_COLORS, val: currentAssessment.listeningLevel }]
                  : []),
                { key: 'WRITING', val: currentAssessment.writingLevel },
              ] as Array<{ key: keyof typeof DOMAIN_COLORS; val: number }>
            ).map(({ key, val }) => (
              <div key={key} className="text-center">
                <p className="text-xs text-gray-400">{DOMAIN_SHORT_KO[key]}</p>
                <p className="mt-1 text-2xl font-black" style={{ color: DOMAIN_COLORS[key] }}>
                  Lv.{val}
                </p>
              </div>
            ))
          )}
        </div>

        {currentAssessment && (
          <p className="mt-3 text-xs text-gray-400">
            마지막 레벨 테스트:{' '}
            {new Date(currentAssessment.assessedAt).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {' '}({Math.floor((Date.now() - new Date(currentAssessment.assessedAt).getTime()) / 86400000)}일 전)
          </p>
        )}
      </div>

      {/* 승급 진행 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Level {promotionProgress.targetLevel} 승급 진행
        </h3>
        <div className="space-y-3">
          {[
            { label: '레벨 테스트', cond: promotionProgress.conditions.levelTest },
            { label: '단원 테스트', cond: promotionProgress.conditions.unitTests },
            { label: '학습 활동', cond: promotionProgress.conditions.learningActivity },
          ].map(({ label, cond }) => (
            <div key={label} className="flex items-start gap-2">
              {cond.met ? (
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#1FAF54]" />
              ) : (
                <Circle size={15} className="mt-0.5 shrink-0 text-gray-300" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${cond.met ? 'text-[#1FAF54]' : 'text-gray-700'}`}>
                  {label}
                </p>
                <p className="text-xs text-gray-400">{cond.detail}</p>
                {!cond.met && cond.progress !== undefined && cond.progress > 0 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#1865F2]"
                      style={{ width: `${cond.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* b) 레벨 테스트 이력 */}
      {levelAssessments.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-700">레벨 평가 이력</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['날짜', '유형', '문법', '어휘', '읽기', '듣기', '쓰기', '종합'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {levelAssessments.map((la) => {
                  const typeColor = ASSESSMENT_TYPE_COLOR[la.assessmentType] ?? '#6B7280'
                  return (
                    <tr key={la.id} className={la.isCurrent ? 'bg-[#EEF4FF]/50' : 'hover:bg-gray-50'}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                        {new Date(la.assessedAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
                        >
                          {ASSESSMENT_TYPE_LABEL[la.assessmentType] ?? la.assessmentType}
                        </span>
                        {la.isCurrent && (
                          <span className="ml-1 rounded-full bg-[#1865F2]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#1865F2]">현재</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: DOMAIN_COLORS.GRAMMAR }}>
                        Lv{la.grammarLevel}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: DOMAIN_COLORS.VOCABULARY }}>
                        Lv{la.vocabularyLevel}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: DOMAIN_COLORS.READING }}>
                        Lv{la.readingLevel}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: DOMAIN_COLORS.LISTENING }}>
                        {la.listeningLevel != null ? `Lv${la.listeningLevel}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: DOMAIN_COLORS.WRITING }}>
                        Lv{la.writingLevel}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">
                        Lv{la.overallLevel}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* c) 수동 조정 Dialog */}
      {showOverrideDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="mb-1 text-base font-bold text-gray-900">레벨 수동 변경</h3>
            <p className="mb-4 text-xs text-gray-500">
              ⚠️ 수동 조정은 기록에 남으며, 다음 레벨 테스트에서 재측정됩니다.
            </p>

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                변경할 레벨
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((lv) => (
                  <button
                    key={lv}
                    onClick={() => setOverrideLevel(lv)}
                    className={`h-10 rounded-xl text-sm font-bold transition-colors ${
                      overrideLevel === lv
                        ? 'bg-[#1865F2] text-white'
                        : 'border border-gray-200 text-gray-600 hover:border-[#1865F2] hover:text-[#1865F2]'
                    }`}
                  >
                    {lv}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                조정 사유 <span className="text-[#D92916]">*</span>
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="예: 학생의 학습 수준을 직접 평가한 결과 조정"
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-300 focus:border-[#1865F2] focus:outline-none"
              />
              {overrideError && (
                <p className="mt-1 text-xs text-[#D92916]">{overrideError}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowOverrideDialog(false); setOverrideReason(''); setOverrideError('') }}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleOverride}
                disabled={isPending}
                className="flex-1 h-11 rounded-xl bg-[#1865F2] text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? '변경 중...' : `Level ${overrideLevel}로 변경`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'score', label: '성적 종합', icon: BarChart2 },
  { id: 'level', label: '레벨 관리', icon: TrendingUp },
  { id: 'path', label: '학습 경로', icon: BookOpen },
  { id: 'comment', label: '교사 코멘트', icon: MessageSquare },
  { id: 'attendance', label: '출석', icon: Calendar },
] as const

type TabId = (typeof TABS)[number]['id']

export function StudentDetailClient({
  studentId,
  studentName: _studentName,
  currentLevel,
  classId,
  testSessions,
  learningPath,
  comments,
  attendance,
  levelAssessments,
  promotionProgress,
}: {
  studentId: string
  studentName: string
  currentLevel: number
  classId: string
  testSessions: SessionData[]
  learningPath: LearningPathData | null
  comments: CommentData[]
  attendance: AttendanceData[]
  levelAssessments: LevelAssessmentData[]
  promotionProgress: PromotionProgress
}) {
  const [activeTab, setActiveTab] = useState<TabId>('score')

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === id
                ? 'border-[#1865F2] text-[#1865F2]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'score' && (
        <ScoreTab sessions={testSessions} currentLevel={currentLevel} />
      )}
      {activeTab === 'level' && (
        <LevelTab
          studentId={studentId}
          currentLevel={currentLevel}
          levelAssessments={levelAssessments}
          promotionProgress={promotionProgress}
        />
      )}
      {activeTab === 'path' && (
        <LearningPathTab studentId={studentId} learningPath={learningPath} />
      )}
      {activeTab === 'comment' && (
        <CommentTab studentId={studentId} comments={comments} />
      )}
      {activeTab === 'attendance' && (
        <AttendanceTab studentId={studentId} classId={classId} attendance={attendance} />
      )}
    </div>
  )
}
