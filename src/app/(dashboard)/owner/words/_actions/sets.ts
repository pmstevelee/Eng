'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { mapOxfordCefrToWegoupLevel } from '@/lib/words/cefr-mapping'
import type { WordTestMode } from '@/generated/prisma'
import { ExamCategory } from '@/generated/prisma'

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
  examCategories: z.array(z.nativeEnum(ExamCategory)).default([]),
  page: z.coerce.number().int().min(1).default(1),
})

export type WordSearchResult = {
  id: string
  term: string
  meaning: string | null
  partOfSpeech: string | null
  cefrLevel: number
  oxfordCefr: string | null
  examCategories: string[]
}

export async function searchWordsForOwner(
  input: z.infer<typeof SearchWordsSchema>,
): Promise<{ words: WordSearchResult[]; total: number }> {
  const owner = await getAuthedOwner()
  if (!owner) return { words: [], total: 0 }

  const { query, oxfordCefr, examCategories, page } = SearchWordsSchema.parse(input)
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
    ...(examCategories.length > 0
      ? { examCategories: { some: { category: { in: examCategories } } } }
      : {}),
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
        examCategories: { select: { category: true } },
      },
      orderBy: [{ cefrLevel: 'asc' }, { term: 'asc' }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.word.count({ where }),
  ])

  return {
    words: words.map((w) => ({
      ...w,
      examCategories: w.examCategories.map((c) => c.category),
    })),
    total,
  }
}

// ─── 사용 가능한 단어 수 ───────────────────────────────────────────────────────

const OXFORD_CEFR_VALUES = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
type OxfordCefrValue = (typeof OXFORD_CEFR_VALUES)[number]

function levelToOxfordCefr(level: number): OxfordCefrValue {
  const idx = Math.min(5, Math.max(1, Math.ceil(level / 2)))
  return OXFORD_CEFR_VALUES[idx - 1]
}

/** 세트 이름에 붙일 생성 날짜 접미사, 예: "(2026-09-05)" */
function setCreationDateSuffix(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `(${y}-${m}-${day})`
}

function buildAutoWhere(
  cefrLevels: OxfordCefrValue[],
  excludeWordIds: string[],
  examCategories: ExamCategory[] = [],
) {
  return {
    ...(cefrLevels.length > 0 ? { oxfordCefr: { in: cefrLevels } } : {}),
    ...(excludeWordIds.length > 0 ? { id: { notIn: excludeWordIds } } : {}),
    ...(examCategories.length > 0
      ? { examCategories: { some: { category: { in: examCategories } } } }
      : {}),
  }
}

const CountAvailableSchema = z.object({
  cefrLevels: z.array(z.enum(OXFORD_CEFR_VALUES)).default([]),
  excludeWordIds: z.array(z.string().uuid()).default([]),
  examCategories: z.array(z.nativeEnum(ExamCategory)).default([]),
})

export async function getAvailableWordCountForOwner(
  input: z.infer<typeof CountAvailableSchema>,
): Promise<number> {
  const owner = await getAuthedOwner()
  if (!owner) return 0

  const parsed = CountAvailableSchema.safeParse(input)
  if (!parsed.success) return 0
  const { cefrLevels, excludeWordIds, examCategories } = parsed.data

  return prisma.word.count({
    where: buildAutoWhere(cefrLevels, excludeWordIds, examCategories),
  })
}

// ─── 세트 생성 ───────────────────────────────────────────────────────────────

const TestAssignmentOptionsSchema = z.object({
  title: z.string().min(1, '시험 제목을 입력하세요.').max(100),
  mode: z.enum(['EN_TO_KO', 'KO_TO_EN', 'SPELL', 'MIXED']),
  timePerQuestion: z.coerce.number().int().min(1).max(60),
  numQuestions: z.coerce.number().int().min(5).max(100),
  passingScore: z.coerce.number().int().min(1).max(100),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  classIds: z.array(z.string().uuid()).optional(),
  studentIds: z.array(z.string().uuid()).min(1, '시험을 배정할 학생을 한 명 이상 선택하세요.'),
})

const CreateOwnerSetSchema = z.object({
  title: z.string().min(1, '세트 이름을 입력하세요.').max(100),
  description: z.string().max(300).optional(),
  cefrLevel: z.coerce.number().int().min(1).max(10),
  wordIds: z
    .array(z.string().uuid())
    .min(1, '단어를 1개 이상 추가하세요.')
    .max(1000, '한 세트에는 단어를 최대 1,000개까지 담을 수 있습니다.'),
  testAssignment: TestAssignmentOptionsSchema.optional(),
})

export async function createOwnerWordSet(
  input: z.infer<typeof CreateOwnerSetSchema>,
): Promise<{ error?: string; setId?: string }> {
  const owner = await getAuthedOwner()
  if (!owner) return { error: '인증이 필요합니다.' }

  const parsed = CreateOwnerSetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? '입력 오류' }

  const { title, description, cefrLevel, wordIds, testAssignment } = parsed.data
  const uniqueWordIds = wordIds.filter((id, idx) => wordIds.indexOf(id) === idx)

  if (testAssignment && testAssignment.numQuestions > uniqueWordIds.length) {
    return { error: `시험 문항 수(${testAssignment.numQuestions})가 세트 단어 수(${uniqueWordIds.length})보다 많습니다.` }
  }

  const dateSuffix = setCreationDateSuffix()

  const { set, assignmentId } = await prisma.$transaction(async (tx) => {
    const set = await tx.wordSet.create({
      data: {
        title: `${title} ${dateSuffix}`,
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

    let assignmentId: string | undefined
    if (testAssignment) {
      const assignment = await tx.wordTestAssignment.create({
        data: {
          teacherId: owner.id,
          academyId: owner.academyId!,
          setId: set.id,
          title: `${testAssignment.title} ${dateSuffix}`,
          mode: testAssignment.mode as WordTestMode,
          timePerQuestion: testAssignment.timePerQuestion,
          numQuestions: testAssignment.numQuestions,
          passingScore: testAssignment.passingScore,
          startsAt: testAssignment.startsAt ? new Date(testAssignment.startsAt) : null,
          endsAt: testAssignment.endsAt ? new Date(testAssignment.endsAt) : null,
          classAssignments:
            testAssignment.classIds && testAssignment.classIds.length > 0
              ? { create: testAssignment.classIds.map((classId) => ({ classId })) }
              : undefined,
          studentAssignments: { create: testAssignment.studentIds.map((studentId) => ({ studentId })) },
        },
      })
      assignmentId = assignment.id
    }

    return { set, assignmentId }
  })

  revalidatePath('/owner/words')
  if (assignmentId) {
    redirect(`/owner/words/sets/${set.id}/test/${assignmentId}/results`)
  }
  redirect(`/owner/words/sets/${set.id}`)
}

// ─── 세트 수정 ───────────────────────────────────────────────────────────────

const UpdateOwnerSetSchema = z.object({
  title: z.string().min(1, '세트 이름을 입력하세요.').max(100),
  description: z.string().max(300).optional(),
  cefrLevel: z.coerce.number().int().min(1).max(10),
  wordIds: z
    .array(z.string().uuid())
    .min(1, '단어를 1개 이상 추가하세요.')
    .max(1000, '한 세트에는 단어를 최대 1,000개까지 담을 수 있습니다.'),
})

export async function updateOwnerWordSet(
  setId: string,
  input: z.infer<typeof UpdateOwnerSetSchema>,
): Promise<{ error?: string }> {
  const owner = await getAuthedOwner()
  if (!owner) return { error: '인증이 필요합니다.' }

  const parsed = UpdateOwnerSetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? '입력 오류' }

  const existing = await prisma.wordSet.findFirst({
    where: { id: setId, academyId: owner.academyId! },
    select: { id: true, source: true },
  })
  if (!existing) return { error: '세트를 찾을 수 없습니다.' }
  if (existing.source === 'PUBLISHER') return { error: '시스템 기본 세트는 수정할 수 없습니다.' }

  const { title, description, cefrLevel, wordIds } = parsed.data
  const uniqueWordIds = wordIds.filter((id, idx) => wordIds.indexOf(id) === idx)

  await prisma.$transaction([
    prisma.wordSet.update({
      where: { id: setId },
      data: { title, description: description ?? null, cefrLevel },
    }),
    prisma.wordSetItem.deleteMany({ where: { setId } }),
    prisma.wordSetItem.createMany({
      data: uniqueWordIds.map((wordId, i) => ({ setId, wordId, order: i })),
    }),
  ])

  revalidatePath('/owner/words')
  revalidatePath(`/owner/words/sets/${setId}`)
  redirect(`/owner/words/sets/${setId}`)
}

// ─── 일자별 세트 자동 생성 ────────────────────────────────────────────────────

const AutoCreateDailySetsSchema = z.object({
  titleBase: z.string().min(1, '세트 이름을 입력하세요.').max(80),
  description: z.string().max(300).optional(),
  cefrLevel: z.coerce.number().int().min(1).max(10),
  cefrLevels: z.array(z.enum(OXFORD_CEFR_VALUES)).default([]),
  examCategories: z.array(z.nativeEnum(ExamCategory)).default([]),
  perDay: z.coerce.number().int().min(1).max(200),
  totalDays: z.coerce.number().int().min(1).max(120),
  order: z.enum(['alphabetical', 'random']).default('random'),
  startDate: z.string().min(1, '학습 시작일을 선택하세요.'),
  excludeWeekends: z.boolean().default(false),
  testAssignment: TestAssignmentOptionsSchema.optional(),
})

/** startDate부터 실제 학습일(주말 제외 옵션 반영) 날짜를 count개 순서대로 생성 */
function buildLearningDates(startDate: string, count: number, excludeWeekends: boolean): string[] {
  const dates: string[] = []
  const cur = new Date(startDate + 'T00:00:00')
  while (dates.length < count) {
    const day = cur.getDay()
    if (!excludeWeekends || (day !== 0 && day !== 6)) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export async function autoCreateOwnerDailySets(
  input: z.infer<typeof AutoCreateDailySetsSchema>,
): Promise<{ error?: string; createdSets?: number }> {
  const owner = await getAuthedOwner()
  if (!owner) return { error: '인증이 필요합니다.' }

  const parsed = AutoCreateDailySetsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? '입력 오류' }

  const { titleBase, description, cefrLevel, cefrLevels, examCategories, perDay, totalDays, order, startDate, excludeWeekends, testAssignment } =
    parsed.data
  const effectiveLevels = cefrLevels.length > 0 ? cefrLevels : [levelToOxfordCefr(cefrLevel)]

  const need = perDay * totalDays
  const where = buildAutoWhere(effectiveLevels, [], examCategories)

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
  const learningDates = buildLearningDates(startDate, chunks.length, excludeWeekends)
  const setsData = chunks.map((_, d) => ({
    id: randomUUID(),
    title: multiDay
      ? `${titleBase} (${learningDates[d]}) ${d + 1}일차`
      : `${titleBase} (${learningDates[d]})`,
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

  const dbOps = [
    prisma.wordSet.createMany({ data: setsData }),
    prisma.wordSetItem.createMany({ data: itemsData }),
  ]

  if (testAssignment) {
    const assignmentsData = chunks.map((chunk, d) => ({
      id: randomUUID(),
      teacherId: owner.id,
      academyId: owner.academyId!,
      setId: setsData[d].id,
      title: multiDay
        ? `${testAssignment.title} (${learningDates[d]}) ${d + 1}일차`
        : `${testAssignment.title} (${learningDates[d]})`,
      mode: testAssignment.mode as WordTestMode,
      timePerQuestion: testAssignment.timePerQuestion,
      numQuestions: Math.min(testAssignment.numQuestions, chunk.length),
      passingScore: testAssignment.passingScore,
      startsAt: testAssignment.startsAt ? new Date(testAssignment.startsAt) : null,
      endsAt: testAssignment.endsAt ? new Date(testAssignment.endsAt) : null,
    }))
    const studentAssignmentsData = assignmentsData.flatMap((a) =>
      testAssignment.studentIds.map((studentId) => ({ assignmentId: a.id, studentId })),
    )
    dbOps.push(prisma.wordTestAssignment.createMany({ data: assignmentsData }))
    dbOps.push(prisma.wordTestStudentAssignment.createMany({ data: studentAssignmentsData }))
    if (testAssignment.classIds && testAssignment.classIds.length > 0) {
      const classAssignmentsData = assignmentsData.flatMap((a) =>
        testAssignment.classIds!.map((classId) => ({ assignmentId: a.id, classId })),
      )
      dbOps.push(prisma.wordTestClassAssignment.createMany({ data: classAssignmentsData }))
    }
  }

  await prisma.$transaction(dbOps)

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

// ─── 세트 일괄 삭제 ───────────────────────────────────────────────────────────

const DeleteWordSetsSchema = z.object({
  setIds: z.array(z.string().uuid()).min(1, '삭제할 세트를 선택하세요.'),
})

export async function deleteOwnerWordSets(
  setIds: string[],
): Promise<{ error?: string; deletedCount?: number; skippedTitles?: string[] }> {
  const owner = await getAuthedOwner()
  if (!owner) return { error: '인증이 필요합니다.' }

  const parsed = DeleteWordSetsSchema.safeParse({ setIds })
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? '입력 오류' }

  const sets = await prisma.wordSet.findMany({
    where: { id: { in: parsed.data.setIds }, academyId: owner.academyId!, source: { not: 'PUBLISHER' } },
    select: { id: true, title: true, _count: { select: { wordTestAssignments: true } } },
  })
  if (sets.length === 0) return { error: '삭제할 수 있는 세트가 없습니다.' }

  // 시험에 이미 출제된 세트는 삭제에서 제외 (FK 제약)
  const deletable = sets.filter((s) => s._count.wordTestAssignments === 0)
  const skippedTitles = sets.filter((s) => s._count.wordTestAssignments > 0).map((s) => s.title)

  if (deletable.length === 0) {
    return { error: '선택한 세트가 모두 시험에 출제되어 삭제할 수 없습니다.' }
  }

  const deletableIds = deletable.map((s) => s.id)
  await prisma.$transaction([
    prisma.wordSetItem.deleteMany({ where: { setId: { in: deletableIds } } }),
    prisma.wordSet.deleteMany({ where: { id: { in: deletableIds } } }),
  ])

  revalidatePath('/owner/words')
  return { deletedCount: deletableIds.length, skippedTitles: skippedTitles.length > 0 ? skippedTitles : undefined }
}
