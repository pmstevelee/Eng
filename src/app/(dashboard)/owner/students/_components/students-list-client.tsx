'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight, AlertCircle, UserPlus, Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { useCallback, useState, useEffect, useRef } from 'react'
import AddStudentDialog from './add-student-dialog'
import EditStudentDialog from './edit-student-dialog'
import DeleteStudentDialog from './delete-student-dialog'

type Student = {
  id: string
  name: string
  email: string
  className: string | null
  classId: string | null
  currentLevel: number
  status: 'ACTIVE' | 'ON_LEAVE' | 'WITHDRAWN'
  createdAt: string
  grade?: number | null
}

type ClassOption = {
  id: string
  name: string
}

type Props = {
  students: Student[]
  classes: ClassOption[]
  totalCount: number
  page: number
  pageSize: number
  initialQuery: string
  initialClassId: string
  initialStatus: string
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

const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'ON_LEAVE', label: '휴원' },
  { value: 'WITHDRAWN', label: '퇴원' },
  { value: 'unassigned', label: '미배정' },
]

// 행 드롭다운 메뉴 컴포넌트
function RowActions({
  student,
  onEdit,
  onDelete,
}: {
  student: Student
  onEdit: (s: Student) => void
  onDelete: (s: Student) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="관리 메뉴"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 bg-white rounded-xl border border-gray-200 shadow-sm py-1 min-w-[120px]">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(student) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={14} className="text-gray-400" />
            정보 수정
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(student) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-red hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
            탈퇴 처리
          </button>
        </div>
      )}
    </div>
  )
}

export default function StudentsListClient({
  students,
  classes,
  totalCount,
  page,
  pageSize,
  initialQuery,
  initialClassId,
  initialStatus,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchInput, setSearchInput] = useState(initialQuery)
  const [isLoading, setIsLoading] = useState(false)

  // 다이얼로그 상태
  const [addOpen, setAddOpen] = useState(false)
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // 탭/필터/페이지 변경 완료 시 로딩 해제
  useEffect(() => {
    setIsLoading(false)
  }, [students, initialStatus, initialClassId, page])

  const pushQuery = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams()
      const values: Record<string, string> = {
        q: initialQuery,
        classId: initialClassId,
        status: initialStatus,
        page: String(page),
        ...overrides,
      }
      Object.entries(values).forEach(([k, v]) => {
        if (v && v !== '1') params.set(k, v)
        else if (k === 'page' && v === '1') return
        else if (v) params.set(k, v)
      })
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, initialQuery, initialClassId, initialStatus, page],
  )

  const handlePageChange = (newPage: number) => {
    setIsLoading(true)
    pushQuery({ page: String(newPage) })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    pushQuery({ q: searchInput, page: '1' })
  }

  const handleStatusTab = (val: string) => {
    setIsLoading(true)
    if (val === 'unassigned') {
      pushQuery({ classId: 'unassigned', status: '', page: '1' })
    } else {
      pushQuery({ status: val, classId: initialClassId === 'unassigned' ? '' : initialClassId, page: '1' })
    }
  }

  const handleClassFilter = (val: string) => {
    setIsLoading(true)
    pushQuery({ classId: val, status: initialStatus, page: '1' })
  }

  const activeTab = initialClassId === 'unassigned' ? 'unassigned' : initialStatus

  // 테이블 헤더 (스켈레톤/실제 공통)
  const tableHeader = (
    <tr className="bg-gray-50 border-b border-gray-200">
      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">학생</th>
      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">반</th>
      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">레벨</th>
      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">상태</th>
      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">가입일</th>
      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">관리</th>
    </tr>
  )

  return (
    <>
      {/* 다이얼로그 */}
      <AddStudentDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        classes={classes}
      />
      <EditStudentDialog
        student={editStudent}
        onClose={() => setEditStudent(null)}
      />
      <DeleteStudentDialog
        student={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />

      <div className="space-y-4">
        {/* 필터 + 학생 추가 버튼 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex gap-3">
            {/* 검색 */}
            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="이름 또는 이메일 검색"
                className="w-full pl-9 pr-4 h-11 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
              />
            </form>

            {/* 반 필터 */}
            <select
              value={initialClassId === 'unassigned' ? '' : initialClassId}
              onChange={(e) => handleClassFilter(e.target.value)}
              className="h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700 min-w-[120px]"
            >
              <option value="">전체 반</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* 학생 추가 버튼 */}
            <button
              onClick={() => setAddOpen(true)}
              className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <UserPlus size={16} />
              학생 추가
            </button>
          </div>

          {/* 상태 탭 */}
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleStatusTab(tab.value)}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
                  activeTab === tab.value
                    ? 'bg-primary-700 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 결과 수 */}
        <p className="text-sm text-gray-500 px-1">
          총 <span className="font-medium text-gray-900">{totalCount}</span>명
        </p>

        {/* 학생 테이블 */}
        {isLoading ? (
          /* 로딩 스켈레톤 */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>{tableHeader}</thead>
                <tbody className="divide-y divide-gray-100">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                          <div className="space-y-1.5">
                            <div className="h-3.5 w-20 bg-gray-200 rounded" />
                            <div className="h-3 w-32 bg-gray-100 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><div className="h-3.5 w-16 bg-gray-200 rounded" /></td>
                      <td className="px-4 py-3"><div className="h-3.5 w-10 bg-gray-200 rounded" /></td>
                      <td className="px-4 py-3"><div className="h-5 w-12 bg-gray-200 rounded-full" /></td>
                      <td className="px-4 py-3"><div className="h-3.5 w-24 bg-gray-200 rounded" /></td>
                      <td className="px-4 py-3"><div className="h-7 w-7 bg-gray-200 rounded-lg ml-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : students.length === 0 ? (
          /* 빈 상태 */
          <div className="bg-white rounded-xl border border-gray-200 py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <AlertCircle size={24} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">
              {initialQuery || initialClassId || initialStatus
                ? '검색 조건에 맞는 학생이 없습니다.'
                : '아직 가입한 학생이 없습니다.'}
            </p>
            {activeTab === 'unassigned' && (
              <p className="text-xs text-gray-400">미배정 학생이 없습니다. 반 배정이 모두 완료되었습니다.</p>
            )}
            {!initialQuery && !initialClassId && !initialStatus && (
              <button
                onClick={() => setAddOpen(true)}
                className="mt-1 h-10 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 flex items-center gap-2 transition-colors"
              >
                <UserPlus size={15} />
                첫 학생 추가하기
              </button>
            )}
          </div>
        ) : (
          /* 학생 목록 테이블 */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>{tableHeader}</thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      {/* 학생 이름 + 이메일 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-primary-700">
                              {student.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <Link
                              href={`/owner/students/${student.id}`}
                              prefetch={false}
                              className="text-sm font-medium text-primary-700 hover:underline underline-offset-2"
                            >
                              {student.name}
                            </Link>
                            <p className="text-xs text-gray-400 mt-0.5">{student.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* 반 */}
                      <td className="px-4 py-3">
                        {student.className ? (
                          <span className="text-sm text-gray-700">{student.className}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-gold bg-accent-gold-light px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-gold" />
                            미배정
                          </span>
                        )}
                      </td>

                      {/* 레벨 */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-700">Lv.{student.currentLevel}</span>
                      </td>

                      {/* 상태 */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_COLOR[student.status]}`}>
                          {STATUS_LABEL[student.status]}
                        </span>
                      </td>

                      {/* 가입일 */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">
                          {new Date(student.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* 관리 버튼 */}
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          student={student}
                          onEdit={(s) => setEditStudent(s)}
                          onDelete={(s) => setDeleteTarget(s)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<Array<number | '...'>>(
                (acc, p, idx, arr) => {
                  if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push('...')
                  acc.push(p)
                  return acc
                },
                [],
              )
              .map((item, idx) =>
                item === '...' ? (
                  <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-gray-400 text-sm">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => handlePageChange(item as number)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      item === page
                        ? 'bg-primary-700 text-white'
                        : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
