'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight, AlertCircle, GraduationCap } from 'lucide-react'
import { useCallback, useState } from 'react'

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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

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
    pushQuery({ q: searchInput, page: '1' })
  }

  return (
    <div className="space-y-4">
      {/* 검색 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <form onSubmit={handleSearch} className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="이름 또는 이메일 검색"
            className="w-full pl-9 pr-4 h-11 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-transparent"
          />
        </form>
      </div>

      {/* 결과 수 */}
      <p className="text-sm text-gray-500 px-1">
        총 <span className="font-medium text-gray-900">{totalCount}</span>명
      </p>

      {/* 교사 테이블 */}
      {teachers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <AlertCircle size={24} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">
            {initialQuery ? '검색 조건에 맞는 교사가 없습니다.' : '아직 가입한 교사가 없습니다.'}
          </p>
          {!initialQuery && (
            <p className="text-xs text-gray-400">초대 코드를 공유하여 교사를 초대하세요.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  교사
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  담당 반
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                  가입일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teachers.map((teacher) => (
                <tr
                  key={teacher.id}
                  className="relative hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/owner/teachers/${teacher.id}`}
                      prefetch={false}
                      className="absolute inset-0 z-[1]"
                      aria-label={`${teacher.name} 상세 보기`}
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent-purple-light flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-accent-purple">
                          {teacher.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{teacher.name}</p>
                        <p className="text-xs text-gray-500">{teacher.email}</p>
                      </div>
                    </div>
                  </td>
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
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">
                      {new Date(teacher.createdAt).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </span>
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
            onClick={() => pushQuery({ page: String(page - 1) })}
            disabled={page === 1}
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<Array<number | '...'>>((acc, p, idx, arr) => {
              if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push('...')
              acc.push(p)
              return acc
            }, [])
            .map((item, idx) =>
              item === '...' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-9 h-9 flex items-center justify-center text-gray-400 text-sm"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => pushQuery({ page: String(item) })}
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
            onClick={() => pushQuery({ page: String(page + 1) })}
            disabled={page === totalPages}
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
