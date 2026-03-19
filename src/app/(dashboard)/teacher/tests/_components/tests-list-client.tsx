'use client'

import { useState } from 'react'
import { Clock, BookOpen, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { deployExistingTest, getStudentsForDeploy } from '../actions'
import { useRouter } from 'next/navigation'

type SessionInfo = { status: string; studentName: string }

type TestItem = {
  id: string
  title: string
  type: string
  status: string
  timeLimitMin: number | null
  questionCount: number
  createdAt: string
  className: string | null
  sessions: SessionInfo[]
}

const TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨',
  UNIT_TEST: '단원',
  PRACTICE: '연습',
}

const TYPE_COLOR: Record<string, string> = {
  LEVEL_TEST: 'bg-blue-50 text-blue-700',
  UNIT_TEST: 'bg-purple-50 text-purple-700',
  PRACTICE: 'bg-teal-50 text-teal-700',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  PUBLISHED: '배포됨',
  GRADED: '채점완료',
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PUBLISHED: 'bg-blue-100 text-blue-700',
  GRADED: 'bg-green-100 text-green-700',
}

const SESSION_LABEL: Record<string, string> = {
  NOT_STARTED: '미응시',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  GRADED: '채점완료',
}

const SESSION_DOT: Record<string, string> = {
  NOT_STARTED: 'bg-gray-400',
  IN_PROGRESS: 'bg-amber-400',
  COMPLETED: 'bg-green-500',
  GRADED: 'bg-blue-500',
}

type DeployClassInfo = { id: string; name: string; students: Array<{ id: string; name: string }> }

export default function TestsListClient({ tests }: { tests: TestItem[] }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFT' | 'PUBLISHED' | 'GRADED'>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Deploy modal state
  const [deployTestId, setDeployTestId] = useState<string | null>(null)
  const [deployClasses, setDeployClasses] = useState<DeployClassInfo[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [loadingDeploy, setLoadingDeploy] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState('')

  const tabs = [
    { key: 'ALL', label: '전체', count: tests.length },
    { key: 'DRAFT', label: '초안', count: tests.filter((t) => t.status === 'DRAFT').length },
    { key: 'PUBLISHED', label: '배포됨', count: tests.filter((t) => t.status === 'PUBLISHED').length },
    { key: 'GRADED', label: '채점완료', count: tests.filter((t) => t.status === 'GRADED').length },
  ] as const

  const filtered = activeTab === 'ALL' ? tests : tests.filter((t) => t.status === activeTab)

  async function openDeployModal(testId: string) {
    setDeployTestId(testId)
    setDeployError('')
    setSelectedStudentIds([])
    setLoadingDeploy(true)
    const result = await getStudentsForDeploy()
    setDeployClasses(result.classes)
    setLoadingDeploy(false)
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    )
  }

  function toggleClass(classStudents: Array<{ id: string }>) {
    const ids = classStudents.map((s) => s.id)
    const allSelected = ids.every((id) => selectedStudentIds.includes(id))
    if (allSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !ids.includes(id)))
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...ids])))
    }
  }

  async function handleDeploy() {
    if (!deployTestId) return
    if (selectedStudentIds.length === 0) {
      setDeployError('배포할 학생을 선택해 주세요.')
      return
    }
    setDeploying(true)
    setDeployError('')
    const result = await deployExistingTest(deployTestId, selectedStudentIds)
    setDeploying(false)
    if (result.error) {
      setDeployError(result.error)
    } else {
      setDeployTestId(null)
      router.refresh()
    }
  }

  return (
    <>
      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 테스트 목록 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">테스트가 없습니다.</p>
          <p className="text-gray-400 text-xs mt-1">새 테스트 만들기 버튼으로 시작하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((test) => {
            const isExpanded = expandedId === test.id
            const notStarted = test.sessions.filter((s) => s.status === 'NOT_STARTED').length
            const inProgress = test.sessions.filter((s) => s.status === 'IN_PROGRESS').length
            const completed = test.sessions.filter((s) => ['COMPLETED', 'GRADED'].includes(s.status)).length

            return (
              <div key={test.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[test.type] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {TYPE_LABEL[test.type] ?? test.type}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[test.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {STATUS_LABEL[test.status] ?? test.status}
                        </span>
                        {test.className && (
                          <span className="text-xs text-gray-500">{test.className}</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate">{test.title}</h3>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span>{test.questionCount}문제</span>
                        {test.timeLimitMin && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {test.timeLimitMin}분
                          </span>
                        )}
                        <span>{new Date(test.createdAt).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {test.status === 'DRAFT' && (
                        <button
                          onClick={() => openDeployModal(test.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-white bg-primary-700 hover:bg-primary-800 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Send size={12} />
                          배포하기
                        </button>
                      )}
                      {test.sessions.length > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : test.id)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 응시 현황 요약 */}
                  {test.sessions.length > 0 && (
                    <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                        미응시 {notStarted}명
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        진행중 {inProgress}명
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                        완료 {completed}명
                      </span>
                    </div>
                  )}
                </div>

                {/* 학생별 상세 현황 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      학생별 응시 현황
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {test.sessions.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${SESSION_DOT[s.status] ?? 'bg-gray-400'}`}
                          />
                          <span className="truncate text-gray-700">{s.studentName}</span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {SESSION_LABEL[s.status] ?? s.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 배포 모달 */}
      {deployTestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">테스트 배포</h2>
              <p className="text-sm text-gray-500 mt-0.5">배포할 학생을 선택하세요.</p>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {loadingDeploy ? (
                <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
              ) : deployClasses.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  등록된 학급이 없습니다.
                </div>
              ) : (
                deployClasses.map((cls) => {
                  const allSelected = cls.students.every((s) => selectedStudentIds.includes(s.id))
                  return (
                    <div key={cls.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          id={`cls-${cls.id}`}
                          checked={allSelected && cls.students.length > 0}
                          onChange={() => toggleClass(cls.students)}
                          className="w-4 h-4 rounded accent-primary-700"
                        />
                        <label
                          htmlFor={`cls-${cls.id}`}
                          className="text-sm font-semibold text-gray-700 cursor-pointer"
                        >
                          {cls.name}
                          <span className="ml-1.5 text-gray-400 font-normal">
                            ({cls.students.length}명)
                          </span>
                        </label>
                      </div>
                      <div className="ml-6 space-y-1.5">
                        {cls.students.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`stu-${s.id}`}
                              checked={selectedStudentIds.includes(s.id)}
                              onChange={() => toggleStudent(s.id)}
                              className="w-4 h-4 rounded accent-primary-700"
                            />
                            <label
                              htmlFor={`stu-${s.id}`}
                              className="text-sm text-gray-600 cursor-pointer"
                            >
                              {s.name}
                            </label>
                          </div>
                        ))}
                        {cls.students.length === 0 && (
                          <p className="text-xs text-gray-400">학생이 없습니다.</p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="p-5 border-t border-gray-100">
              {deployError && <p className="text-red-600 text-sm mb-3">{deployError}</p>}
              <p className="text-sm text-gray-500 mb-3">
                선택된 학생:{' '}
                <span className="font-semibold text-gray-900">{selectedStudentIds.length}명</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeployTestId(null)}
                  disabled={deploying}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={deploying || selectedStudentIds.length === 0}
                  className="flex-1 px-4 py-2.5 bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {deploying ? '배포 중...' : `${selectedStudentIds.length}명에게 배포`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
