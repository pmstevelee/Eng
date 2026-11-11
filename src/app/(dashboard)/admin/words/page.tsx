export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Languages, Search } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import type { Prisma, WordSource } from '@/generated/prisma'
import { LEVELS } from '@/lib/constants/levels'
import { WordTable, type AdminWordRow } from './_components/word-table'

const PAGE_SIZE = 50

const SOURCE_LABEL: Record<WordSource, string> = {
  OXFORD_3000: 'Oxford 3000',
  OXFORD_5000: 'Oxford 5000',
  PUBLISHER: '출판사',
  TEACHER: '교사 등록',
  AI_GENERATED: 'AI 생성',
}
const SOURCES = Object.keys(SOURCE_LABEL) as WordSource[]

const SCOPES = [
  { value: 'public', label: '공용 단어' },
  { value: 'academy', label: '학원 전용' },
  { value: 'all', label: '전체' },
] as const
type Scope = (typeof SCOPES)[number]['value']

interface PageProps {
  searchParams: { q?: string; level?: string; source?: string; scope?: string; page?: string }
}

export default async function AdminWordsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')

  const q = (searchParams.q ?? '').trim()
  const levelNum = Number(searchParams.level)
  const level = Number.isInteger(levelNum) && levelNum >= 1 && levelNum <= 10 ? levelNum : null
  const source = SOURCES.includes(searchParams.source as WordSource)
    ? (searchParams.source as WordSource)
    : null
  const scope: Scope = SCOPES.some((s) => s.value === searchParams.scope)
    ? (searchParams.scope as Scope)
    : 'public'
  const page = Math.max(1, Number(searchParams.page) || 1)

  const where: Prisma.WordWhereInput = {
    ...(scope === 'public' ? { academyId: null } : {}),
    ...(scope === 'academy' ? { academyId: { not: null } } : {}),
    ...(level ? { cefrLevel: level } : {}),
    ...(source ? { source } : {}),
    ...(q
      ? {
          OR: [
            { term: { contains: q, mode: 'insensitive' } },
            { meaning: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [totalCount, words] = await Promise.all([
    prisma.word.count({ where }),
    prisma.word.findMany({
      where,
      orderBy: [{ cefrLevel: 'asc' }, { term: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        term: true,
        partOfSpeech: true,
        meaning: true,
        definition: true,
        example: true,
        contextNote: true,
        cefrLevel: true,
        oxfordCefr: true,
        homonymIndex: true,
        source: true,
        updatedAt: true,
        academy: { select: { name: true } },
        examCategories: { select: { category: true } },
        _count: { select: { wordSetItems: true } },
      },
    }),
  ])

  const rows: AdminWordRow[] = words.map((w) => ({
    id: w.id,
    term: w.term,
    partOfSpeech: w.partOfSpeech,
    meaning: w.meaning,
    definition: w.definition,
    example: w.example,
    contextNote: w.contextNote,
    cefrLevel: w.cefrLevel,
    oxfordCefr: w.oxfordCefr,
    homonymIndex: w.homonymIndex,
    sourceLabel: SOURCE_LABEL[w.source],
    academyName: w.academy?.name ?? null,
    examCategories: w.examCategories.map((c) => c.category),
    setCount: w._count.wordSetItems,
    updatedAt: w.updatedAt.toISOString(),
  }))

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const buildHref = (overrides: Record<string, string | number | null>) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (level) params.set('level', String(level))
    if (source) params.set('source', source)
    params.set('scope', scope)
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) params.delete(key)
      else params.set(key, String(value))
    }
    if (!('page' in overrides)) params.delete('page')
    return `/admin/words?${params.toString()}`
  }

  const chip = (active: boolean) =>
    `inline-flex min-h-[32px] items-center px-3 rounded-full text-xs font-medium transition-colors ${
      active ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
          <Languages size={20} className="text-primary-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">단어 콘텐츠 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            단어학습에 쓰이는 단어의 뜻·정의·예문·레벨을 직접 수정합니다. 수정 내용은 이 단어가 들어 있는
            모든 단어 세트에 바로 반영됩니다.
          </p>
        </div>
      </div>

      {/* 검색·필터 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <form action="/admin/words" className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="scope" value={scope} />
          {level && <input type="hidden" name="level" value={level} />}
          {source && <input type="hidden" name="source" value={source} />}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="영어 단어 또는 한국어 뜻으로 검색"
              className="h-11 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm focus:border-primary-700 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-11 rounded-lg bg-primary-700 px-5 text-sm font-medium text-white hover:bg-primary-800"
          >
            검색
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {SCOPES.map((s) => (
            <Link key={s.value} href={buildHref({ scope: s.value })} className={chip(scope === s.value)}>
              {s.label}
            </Link>
          ))}
          <span className="w-px h-4 bg-gray-200 mx-1" />
          <Link href={buildHref({ source: null })} className={chip(!source)}>
            모든 출처
          </Link>
          {SOURCES.map((s) => (
            <Link key={s} href={buildHref({ source: s })} className={chip(source === s)}>
              {SOURCE_LABEL[s]}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={buildHref({ level: null })} className={chip(!level)}>
            모든 레벨
          </Link>
          {LEVELS.map((l) => (
            <Link key={l.level} href={buildHref({ level: l.level })} className={chip(level === l.level)}>
              Lv{l.level} · {l.cefr}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500">
        검색 결과 <span className="font-semibold text-gray-900">{totalCount.toLocaleString()}</span>개
      </p>

      <WordTable rows={rows} />

      {/* 페이지 이동 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link
              href={buildHref({ page: page - 1 })}
              className="inline-flex h-11 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-700 hover:bg-gray-50"
            >
              이전
            </Link>
          ) : null}
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref({ page: page + 1 })}
              className="inline-flex h-11 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-700 hover:bg-gray-50"
            >
              다음
            </Link>
          ) : null}
        </div>
      )}
    </div>
  )
}
