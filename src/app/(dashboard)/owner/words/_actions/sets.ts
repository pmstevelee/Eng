'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { mapOxfordCefrToWegoupLevel } from '@/lib/words/cefr-mapping'

async function getAuthedOwner() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null
  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'ACADEMY_OWNER' || !user.academyId) return null
  return user
}

// ─── 단어 검색 ───────────────────────────────────────────────────────────────

const SearchWordsSchema = z.object({
  query: z.string().max(80).default(''),
  oxfordCefr: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', '']).optional(),
  page: z.coerce.number().int().min(1).default(1),
})

export type WordSearchResult = {
  id: string
  term: string
  meaning: string | null
  partOfSpeech: string | null
  cefrLevel: number
  oxfordCefr: string | null
}

export async function searchWordsForOwner(
  input: z.infer<typeof SearchWordsSchema>,
): Promise<{ words: WordSearchResult[]; total: number }> {
  const owner = await getAuthedOwner()
  if (!owner) return { words: [], total: 0 }

  const { query, oxfordCefr, page } = SearchWordsSchema.parse(input)
  const PAGE_SIZE = 20
  const skip = (page - 1) * PAGE_SIZE

  const where = {
    ...(query
      ? {
          OR: [
            { term: { contains: query, mode: 'insensitive' as const } },
            { meaning: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(oxfordCefr ? { oxfordCefr: oxfordCefr as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' } : {}),
  }

  const [words, total] = await Promise.all([
    prisma.word.findMany({
      where,
      select: {
        id: true,
        term: true,
        meaning: true,
        partOfSpeech: true,
        cefrLevel: true,
        oxfordCefr: true,
      },
      orderBy: [{ cefrLevel: 'asc' }, { term: 'asc' }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.word.count({ where }),
  ])

  return { words, total }
}

// ─── 사용 가능한 단어 수 ───────────────────────────────────────────────────────

const OXFORD_CEFR_VALUES = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
type OxfordCefrValue = (typeof OXFORD_CEFR_VALUES)[number]

function levelToOxfordCefr(level: number): OxfordCefrValue {
  const idx = Math.min(5, Math.max(1, Math.ceil(level / 2)))
  return OXFORD_CEFR_VALUES[idx - 1]
}

function buildAutoWhere(cefrLevels: OxfordCefrValue[], excludeWordIds: string[]) {
  return {
    ...(cefrLevels.length > 0 ? { oxfordCefr: { in: cefrLevels } } : {}),
    ...(excludeWordIds.length > 0 ? { id: { notIn: excludeWordIds } } : {}),
  }
}

const CountAvailableSchema = z.object({
  cefrLevels: z.array(z.enum(OXFORD_CEFR_VALUES)).default([]),
  excludeWordIds: z.array(z.string().uuid()).default([]),
})

export async function getAvailableWordCountForOwner(
  input: z.infer<typeof CountAvailableSchema>,
): Promise<number> {
  const owner = await getAuthedOwner()
  if (!owner) return 0

  const parsed = CountAvailableSchema.safeParse(input)
  if (!parsed.success) return 0
  const { cefrLevels, excludeWordIds } = parsed.data

  return prisma.word.count({
    where: buildAutoWhere(cefrLevels, excludeWordIds),
  })
}

// ─── 세트 생성 ───────────────────────────────────────────────────────────────

const CreateOwnerSetSchema = z.object({
  title: z.string().min(1, '세트 이름을 입력하세요.').max(100),
  description: z.string().max(300).optional(),
  cefrLevel: z.coerce.number().int().min(1).max(10),
  wordIds: z
    .array(z.string().uuid())
    .min(1, '단어를 1개 이상 추가하세요.')
    .max(1000, '한 세트에는 단어를 최대 1,000개까지 담을 수 있습니다.'),
})

export async function createOwnerWordSet(
  input: z.infer<typeof CreateOwnerSetSchema>,
): Promise<{ error?: string; setId?: string }> {
  const owner = await getAuthedOwner()
  if (!owner) return { error: '인증이 필요합니다.' }

  const parsed = CreateOwnerSetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? '입력 오류' }

  const { title, description, cefrLevel, wordIds } = parsed.data
  const uniqueWordIds = wordIds.filter((id, idx) => wordIds.indexOf(id) === idx)

  const newSet = await prisma.$transaction(async (tx) => {
    const set = await tx.wordSet.create({
      data: {
        title,
        description: description ?? null,
        cefrLevel,
        isPublic: false,
        source: 'TEACHER',
        ownerId: owner.id,
        academyId: owner.academyId!,
      },
    })
    await tx.wordSetItem.createMany({
      data: uniqueWordIds.map((wordId, i) => ({ setId: set.id, wordId, order: i })),
    })
    return set
  })

  revalidatePath('/owner/words')
  redirect(`/owner/words/sets/${newSet.id}`)
}

// ─── 일자별 세트 자동 생성 ────────────────────────────────────────────────────

const AutoCreateDailySetsSchema = z.object({
  titleBase: z.string().min(1, '세트 이름을 입력하세요.').max(80),
  description: z.string().max(300).optional(),
  cefrLevel: z.coerce.number().int().min(1).max(10),
  cefrLevels: z.array(z.enum(OXFORD_CEFR_VALUES)).default([]),
  perDay: z.coerce.number().int().min(1).max(200),
  totalDays: z.coerce.number().int().min(1).max(120),
  order: z.enum(['recommended', 'random']).default('recommended'),
})

export async function autoCreateOwnerDailySets(
  input: z.infer<typeof AutoCreateDailySetsSchema>,
): Promise<{ error?: string; createdSets?: number }> {
  const owner = await getAuthedOwner()
  if (!owner) return { error: '인증이 필요합니다.' }

  const parsed = AutoCreateDailySetsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? '입력 오류' }

  const { titleBase, description, cefrLevel, cefrLevels, perDay, totalDays, order } = parsed.data
  const effectiveLevels = cefrLevels.length > 0 ? cefrLevels : [levelToOxfordCefr(cefrLevel)]

  const need = perDay * totalDays
  const where = buildAutoWhere(effectiveLevels, [])

  let wordIds: string[]
  if (order === 'random') {
    const ids = await prisma.word.findMany({ where, select: { id: true } })
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    wordIds = ids.slice(0, need).map((r) => r.id)
  } else {
    const ids = await prisma.word.findMany({
      where,
      select: { id: true },
      orderBy: [{ cefrLevel: 'asc' }, { term: 'asc' }],
      take: need,
    })
    wordIds = ids.map((r) => r.id)
  }

  if (wordIds.length === 0) {
    return { error: '선택한 레벨에 사용할 수 있는 단어가 없습니다.' }
  }

  const chunks: string[][] = []
  for (let i = 0; i < wordIds.length && chunks.length < totalDays; i += perDay) {
    chunks.push(wordIds.slice(i, i + perDay))
  }

  const multiDay = chunks.length > 1

  const savedCefrLevel = mapOxfordCefrToWegoupLevel(effectiveLevels[0])
  const setsData = chunks.map((_, d) => ({
    id: randomUUID(),
    title: multiDay ? `${titleBase} ${d + 1}일차` : titleBase,
    description: description ?? null,
    cefrLevel: savedCefrLevel,
    isPublic: false,
    source: 'TEACHER' as const,
    ownerId: owner.id,
    academyId: owner.academyId!,
  }))
  const itemsData = chunks.flatMap((chunk, d) =>
    chunk.map((wordId, i) => ({ setId: setsData[d].id, wordId, order: i })),
  )

  await prisma.$transaction([
    prisma.wordSet.createMany({ data: setsData }),
    prisma.wordSetItem.createMany({ data: itemsData }),
  ])

  revalidatePath('/owner/words')
  redirect('/owner/words?tab=sets')
}

// ─── 세트 삭제 ───────────────────────────────────────────────────────────────

export async function deleteOwnerWordSet(
  setId: string,
): Promise<{ error?: string }> {
  const owner = await getAuthedOwner()
  if (!owner) return { error: '인증이 필요합니다.' }

  const wordSet = await prisma.wordSet.findFirst({
    where: { id: setId, academyId: owner.academyId! },
    select: { id: true, source: true },
  })
  if (!wordSet) return { error: '세트를 찾을 수 없습니다.' }
  if (wordSet.source === 'PUBLISHER') return { error: '시스템 기본 세트는 삭제할 수 없습니다.' }

  await prisma.$transaction([
    prisma.wordSetItem.deleteMany({ where: { setId } }),
    prisma.wordSet.delete({ where: { id: setId } }),
  ])

  revalidatePath('/owner/words')
  return {}
}
