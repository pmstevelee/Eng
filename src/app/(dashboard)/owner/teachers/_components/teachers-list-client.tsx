'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Search, ChevronLeft, ChevronRight, AlertCircle,
  GraduationCap, UserPlus, MoreHorizontal, Pencil, Trash2,
} from 'lucide-react'
import { useCallback, useState, useEffect, useRef } from 'react'
import AddTeacherDialog from './add-teacher-dialog'
import EditTeacherDialog from './edit-teacher-dialog'
import DeleteTeacherDialog from './delete-teacher-dialog'

type Teacher = {
  id: string
  name: string
  email: string
  createdAt: string
  classes: Array<{ id: string; name: string }>
}

type Props = {
  teachers: Teacher[]
  totalCount: number
  page: number
  pageSize: number
  initialQuery: string
}

// 행 드롭다운 메뉴
function RowActions({
  teacher,
  onEdit,
  onDelete,
}: {
  teacher: Teacher
  onEdit: (t: Teacher) => void
  onDelete: (t: Teacher) => void
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
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(teacher) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={14} className="text-gray-400" />
            정보 수정
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(teacher) }}
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

export default function TeachersListClient({
  teachers,
  totalCount,
  page,
  pageSize,
  initialQuery,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [searchInput, setSearchInput] = useState(initialQuery)
  const [isLoading, setIsLoading] = useState(false)

  // 다이얼로그 상태
  const [addOpen, setAddOpen] = useState(false)
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // 데이터 변경 시 로딩 해제
  useEffect(() => {
    setIsLoading(false)
  }, [teachers, page])

  const pushQuery = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams()
      const values: Record<string, string> = {
        q: initialQuery,
        page: String(page),
        ...overrides,
      }
      Object.entries(values).forEach(([k, v]) => {
        if (k === 'page' && v === '1') return
        if (v) params.set(k, v)
      })
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, initialQuery, page],
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    pushQuery({ q: searchInput, page: '1' })
  }

  const handlePageChange = (newPage: number) => {
    setIsLoading(true)
    pushQuery({ page: String(newPage) })
  }

  // 테이블 헤더
  const tableHeader = (
    <tr className="bg-gray-50 border-b border-gray-200">
      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">교사</th>
      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">담당 반</th>
      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">가입일</th>
      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">관리</th>
    </tr>
  )

  return (
    <>
      {/* 다이얼로그 */}
      <AddTeacherDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <EditTeacherDialog teacher={editTeacher} onClose={() => setEditTeacher(null)} />
      <DeleteTeacherDialog teacher={deleteTarget} onClose={() => setDeleteTarget(null)} />

      <div className="space-y-4">
        {/* 검색 + 교사 추가 버튼 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex gap-3">
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
            <button
              onClick={() => setAddOpen(true)}
              className="h-11 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <UserPlus size={16} />
              교사 추가
            </button>
          </div>
        </div>

        {/* 결과 수 */}
        <p className="text-sm text-gray-500 px-1">
          총 <span className="font-medium text-gray-900">{totalCount}</span>명
        </p>

        {/* 교사 테이블 */}
        {isLoading ? (
          /* 로딩 스켈레톤 */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
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
                    <td className="px-4 py-3"><div className="h-5 w-20 bg-gray-200 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-3.5 w-24 bg-gray-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-7 w-7 bg-gray-200 rounded-lg ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : teachers.length === 0 ? (
          /* 빈 상태 */
          <div className="bg-white rounded-xl border border-gray-200 py-16 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <AlertCircle size={24} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">
              {initialQuery ? '검색 조건에 맞는 교사가 없습니다.' : '아직 가입한 교사가 없습니다.'}
            </p>
            {!initialQuery && (
              <button
                onClick={() => setAddOpen(true)}
                className="mt-1 h-10 px-4 rounded-xl bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 flex items-center gap-2 transition-colors"
              >
                <UserPlus size={15} />
                첫 교사 추가하기
              </button>
            )}
          </div>
        ) : (
          /* 교사 목록 테이블 */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>{tableHeader}</thead>
              <tbody className="divide-y divide-gray-100">
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50 transition-colors group">
                    {/* 이름 + 이메일 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent-purple-light flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-accent-purple">
                            {teacher.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <Link
                            href={`/owner/teachers/${teacher.id}`}
                            prefetch={false}
                            className="text-sm font-medium text-primary-700 hover:underline underline-offset-2"
                          >
                            {teacher.name}
                          </Link>
                          <p className="text-xs text-gray-400 mt-0.5">{teacher.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* 담당 반 */}
                    <td className="px-4 py-3">
                      {teacher.classes.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-gold bg-accent-gold-light px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-gold" />
                          미배정
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {teacher.classes.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full"
                            >
                              <GraduationCap size={10} />
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* 가입일 */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">
                        {new Date(teacher.createdAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        })}
                      </span>
                    </td>

                    {/* 관리 버튼 */}
                    <td className="px-4 py-3 text-right">
                      <RowActions
                        teacher={teacher}
                        onEdit={(t) => setEditTeacher(t)}
                        onDelete={(t) => setDeleteTarget(t)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-gray-400 text-sm">…</span>
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
