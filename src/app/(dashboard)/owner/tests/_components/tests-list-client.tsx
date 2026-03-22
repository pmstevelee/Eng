'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Send, BookOpen, ChevronRight, X } from 'lucide-react'
import { deployExistingTest, getStudentsForDeploy } from '../actions'
import { useRouter } from 'next/navigation'

type TestItem = {
  id: string
  title: string
  type: string
  status: string
  timeLimitMin: number | null
  questionCount: number
  totalScore: number
  createdAt: string
  className: string | null
  classId: string | null
  creatorName: string | null
  creatorId: string | null
  sessionCount: number
  completedCount: number
  avgScore: number | null
  responseRate: number | null
}

type FilterClass = { id: string; name: string }
type FilterTeacher = { id: string; name: string }
type DeployClassInfo = { id: string; name: string; students: Array<{ id: string; name: string }> }

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

export default function TestsListClient({
  tests,
  classes,
  teachers,
}: {
  tests: TestItem[]
  classes: FilterClass[]
  teachers: FilterTeacher[]
}) {
  const router = useRouter()

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [classFilter, setClassFilter] = useState('ALL')
  const [teacherFilter, setTeacherFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Deploy modal
  const [deployTestId, setDeployTestId] = useState<string | null>(null)
  const [deployClasses, setDeployClasses] = useState<DeployClassInfo[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [loadingDeploy, setLoadingDeploy] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState('')

  const filtered = useMemo(() => {
    return tests.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false
      if (classFilter !== 'ALL' && t.classId !== classFilter) return false
      if (teacherFilter !== 'ALL' && t.creatorId !== teacherFilter) return false
      if (dateFrom) {
        const from = new Date(dateFrom)
        if (new Date(t.createdAt) < from) return false
      }
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59)
        if (new Date(t.createdAt) > to) return false
      }
      return true
    })
  }, [tests, search, typeFilter, classFilter, teacherFilter, dateFrom, dateTo])

  const hasActiveFilters =
    search || typeFilter !== 'ALL' || classFilter !== 'ALL' || teacherFilter !== 'ALL' || dateFrom || dateTo

  function clearFilters() {
    setSearch('')
    setTypeFilter('ALL')
    setClassFilter('ALL')
    setTeacherFilter('ALL')
    setDateFrom('')
    setDateTo('')
  }

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
      {/* 필터 영역 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        {/* 검색 */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="테스트 제목 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700"
          />
        </div>

        {/* 필터 행 */}
        <div className="flex flex-wrap gap-2">
          {/* 유형 */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 bg-white"
          >
            <option value="ALL">전체 유형</option>
            <option value="LEVEL_TEST">레벨 테스트</option>
            <option value="UNIT_TEST">단원 테스트</option>
            <option value="PRACTICE">연습</option>
          </select>

          {/* 반 */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 bg-white"
          >
            <option value="ALL">전체 반</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* 교사 */}
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 bg-white"
          >
            <option value="ALL">전체 교사</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* 기간 */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 bg-white"
          />
          <span className="self-center text-gray-400 text-sm">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-700/20 focus:border-primary-700 bg-white"
          />

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-2"
            >
              <X size={14} />
              초기화
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400">
          {filtered.length}개의 테스트
          {hasActiveFilters && ` (전체 ${tests.length}개 중)`}
        </p>
      </div>

      {/* 테이블 */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <BookOpen size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {hasActiveFilters ? '조건에 맞는 테스트가 없습니다.' : '테스트가 없습니다.'}
          </p>
          {!hasActiveFilters && (
            <p className="text-gray-400 text-xs mt-1">새 테스트 만들기 버튼으로 시작하세요.</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">
                    테스트 제목
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    유형
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    출제 교사
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    대상 반
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    응시율
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    평균 점수
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    상태
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                    날짜
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50 transition-colors group">
                    {/* 제목 */}
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/owner/tests/${test.id}`}
                        className="font-medium text-gray-900 hover:text-primary-700 transition-colors line-clamp-1"
                      >
                        {test.title}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">{test.questionCount}문제</p>
                    </td>

                    {/* 유형 */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[test.type] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {TYPE_LABEL[test.type] ?? test.type}
                      </span>
                    </td>

                    {/* 출제 교사 */}
                    <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">
                      {test.creatorName ?? '-'}
                    </td>

                    {/* 대상 반 */}
                    <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap">
                      {test.className ?? <span className="text-gray-400">-</span>}
                    </td>

                    {/* 응시율 */}
                    <td className="px-4 py-3.5 text-right">
                      {test.sessionCount === 0 ? (
                        <span className="text-gray-400">-</span>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-medium text-gray-900">
                            {test.responseRate ?? 0}%
                          </span>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-700 rounded-full"
                              style={{ width: `${test.responseRate ?? 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">
                            {test.completedCount}/{test.sessionCount}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* 평균 점수 */}
                    <td className="px-4 py-3.5 text-right">
                      {test.avgScore !== null ? (
                        <span className="font-semibold text-gray-900">{test.avgScore}점</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>

                    {/* 상태 */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[test.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {STATUS_LABEL[test.status] ?? test.status}
                      </span>
                    </td>

                    {/* 날짜 */}
                    <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">
                      {new Date(test.createdAt).toLocaleDateString('ko-KR')}
                    </td>

                    {/* 액션 */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        {test.status === 'DRAFT' && (
                          <button
                            onClick={() => openDeployModal(test.id)}
                            className="flex items-center gap-1.5 text-xs font-medium text-white bg-primary-700 hover:bg-primary-800 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Send size={11} />
                            배포
                          </button>
                        )}
                        <Link
                          href={`/owner/tests/${test.id}`}
                          className="text-gray-400 hover:text-gray-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <div className="text-center py-8 text-gray-400 text-sm">등록된 학급이 없습니다.</div>
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
