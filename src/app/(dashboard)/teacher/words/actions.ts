'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import type { WordTestMode } from '@/generated/prisma'

async function getAuthedTeacher() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) return null
  const user = await prisma.user.findUnique({
    where: { id: authUser.id, isDeleted: false },
    select: { id: true, role: true, academyId: true },
  })
  if (!user || user.role !== 'TEACHER' || !user.academyId) return null
  return user
}

// ─── 단어 시험 생성 ─────────────────────────────────────────────────────────────

const CreateWordTestSchema = z.object({
  setId: z.string().uuid(),
  title: z.string().min(1).max(100),
  mode: z.enum(['EN_TO_KO', 'KO_TO_EN', 'SPELL', 'MIXED']),
  timePerQuestion: z.coerce.number().int().min(1).max(60),
  numQuestions: z.coerce.number().int().min(5).max(100),
  passingScore: z.coerce.number().int().min(1).max(100),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  classIds: z.array(z.string().uuid()).optional(),
  studentIds: z.array(z.string().uuid()).optional(),
})

export type CreateWordTestInput = z.infer<typeof CreateWordTestSchema>

export async function createWordTestAssignment(input: CreateWordTestInput): Promise<{ error?: string; id?: string }> {
  const teacher = await getAuthedTeacher()
  if (!teacher) return { error: '인증이 필요합니다.' }

  const parsed = CreateWordTestSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? '입력 오류' }

  const { setId, title, mode, timePerQuestion, numQuestions, passingScore, startsAt, endsAt, classIds, studentIds } =
    parsed.data

  // 세트가 접근 가능한지 확인
  const wordSet = await prisma.wordSet.findFirst({
    where: {
      id: setId,
      OR: [{ academyId: teacher.academyId }, { isPublic: true }, { ownerId: teacher.id }],
    },
    select: { id: true, _count: { select: { items: true } } },
  })
  if (!wordSet) return { error: '단어 세트를 찾을 수 없습니다.' }
  if (wordSet._count.items < numQuestions) {
    return { error: `단어 세트에 문항 수(${numQuestions})보다 단어가 부족합니다.` }
  }

  const assignment = await prisma.wordTestAssignment.create({
    data: {
      teacherId: teacher.id,
      academyId: teacher.academyId!,
      setId,
      title,
      mode: mode as WordTestMode,
      timePerQuestion,
      numQuestions,
      passingScore,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      classAssignments:
        classIds && classIds.length > 0
          ? { create: classIds.map((classId) => ({ classId })) }
          : undefined,
      studentAssignments:
        studentIds && studentIds.length > 0
          ? { create: studentIds.map((studentId) => ({ studentId })) }
          : undefined,
    },
  })

  revalidatePath(`/teacher/words/sets/${setId}`)
  return { id: assignment.id }
}

// ─── 학원 반 목록 ────────────────────────────────────────────────────────────────

export async function getClassesForTeacher() {
  const teacher = await getAuthedTeacher()
  if (!teacher) return []

  return prisma.class.findMany({
    where: { academyId: teacher.academyId!, isActive: true },
    select: {
      id: true,
      name: true,
      _count: { select: { students: true } },
    },
    orderBy: { name: 'asc' },
  })
}

// ─── 단어 검색 (세트빌더용) ─────────────────────────────────────────────────────

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

export async function searchWords(
  input: z.infer<typeof SearchWordsSchema>,
): Promise<{ words: WordSearchResult[]; total: number }> {
  const teacher = await getAuthedTeacher()
  if (!teacher) return { words: [], total: 0 }

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

// ─── 자동 생성: 사용 가능한 단어 수 ─────────────────────────────────────────────

const OXFORD_CEFR_VALUES = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
type OxfordCefrValue = (typeof OXFORD_CEFR_VALUES)[number]

const CountAvailableSchema = z.object({
  cefrLevels: z.array(z.enum(OXFORD_CEFR_VALUES)).default([]),
  excludeWordIds: z.array(z.string().uuid()).default([]),
})

/** 선택한 레벨 + 이미 추가한 단어 제외 시 남은 단어 수 (경고 표시용) */
export async function getAvailableWordCount(
  input: z.infer<typeof CountAvailableSchema>,
): Promise<number> {
  const teacher = await getAuthedTeacher()
  if (!teacher) return 0

  const parsed = CountAvailableSchema.safeParse(input)
  if (!parsed.success) return 0
  const { cefrLevels, excludeWordIds } = parsed.data

  return prisma.word.count({
    where: buildAutoWhere(cefrLevels, excludeWordIds),
  })
}

// ─── 자동 생성: 조건에 맞는 단어 자동 선택 ───────────────────────────────────────

const AutoSelectSchema = z.object({
  cefrLevels: z.array(z.enum(OXFORD_CEFR_VALUES)).default([]),
  count: z.coerce.number().int().min(1).max(1000),
  order: z.enum(['recommended', 'random']).default('recommended'),
  excludeWordIds: z.array(z.string().uuid()).default([]),
})

/** 레벨/개수/정렬 조건으로 단어를 자동 선택 (이미 추가된 단어는 제외) */
export async function autoSelectWords(
  input: z.infer<typeof AutoSelectSchema>,
): Promise<{ words: WordSearchResult[]; available: number }> {
  const teacher = await getAuthedTeacher()
  if (!teacher) return { words: [], available: 0 }

  const parsed = AutoSelectSchema.safeParse(input)
  if (!parsed.success) return { words: [], available: 0 }
  const { cefrLevels, count, order, excludeWordIds } = parsed.data

  const where = buildAutoWhere(cefrLevels, excludeWordIds)
  const select = {
    id: true,
    term: true,
    meaning: true,
    partOfSpeech: true,
    cefrLevel: true,
    oxfordCefr: true,
  } as const

  const available = await prisma.word.count({ where })

  if (order === 'random') {
    // 매칭되는 id만 가볍게 로드 후 셔플 → 상위 count개 선택
    const ids = await prisma.word.findMany({ where, select: { id: true } })
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    const pickedIds = ids.slice(0, count).map((r) => r.id)
    const picked = await prisma.word.findMany({ where: { id: { in: pickedIds } }, select })
    const byId = new Map(picked.map((w) => [w.id, w]))
    const words: WordSearchResult[] = pickedIds
      .map((id) => byId.get(id))
      .filter((w): w is NonNullable<typeof w> => w !== undefined)
    return { words, available }
  }

  // 추천순: 레벨 → 알파벳 순으로 앞에서부터
  const words = await prisma.word.findMany({
    where,
    select,
    orderBy: [{ cefrLevel: 'asc' }, { term: 'asc' }],
    take: count,
  })
  return { words, available }
}

function buildAutoWhere(cefrLevels: OxfordCefrValue[], excludeWordIds: string[]) {
  return {
    ...(cefrLevels.length > 0 ? { oxfordCefr: { in: cefrLevels } } : {}),
    ...(excludeWordIds.length > 0 ? { id: { notIn: excludeWordIds } } : {}),
  }
}

// ─── 교사 세트 생성 ──────────────────────────────────────────────────────────────

const CreateTeacherSetSchema = z.object({
  title: z.string().min(1, '세트 이름을 입력하세요.').max(100),
  description: z.string().max(300).optional(),
  cefrLevel: z.coerce.number().int().min(1).max(10),
  wordIds: z
    .array(z.string().uuid())
    .min(1, '단어를 1개 이상 추가하세요.')
    .max(1000, '한 세트에는 단어를 최대 1,000개까지 담을 수 있습니다.'),
})

export async function createTeacherWordSet(
  input: z.infer<typeof CreateTeacherSetSchema>,
): Promise<{ error?: string; setId?: string }> {
  const teacher = await getAuthedTeacher()
  if (!teacher) return { error: '인증이 필요합니다.' }

  const parsed = CreateTeacherSetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? '입력 오류' }

  const { title, description, cefrLevel, wordIds } = parsed.data

  // 중복 wordId 제거 + 순서 보존
  const uniqueWordIds = wordIds.filter((id, idx) => wordIds.indexOf(id) === idx)

  const newSet = await prisma.$transaction(async (tx) => {
    const set = await tx.wordSet.create({
      data: {
        title,
        description: description ?? null,
        cefrLevel,
        isPublic: false,
        source: 'TEACHER',
        ownerId: teacher.id,
        academyId: teacher.academyId!,
      },
    })
    await tx.wordSetItem.createMany({
      data: uniqueWordIds.map((wordId, i) => ({ setId: set.id, wordId, order: i })),
    })
    return set
  })

  revalidatePath('/teacher/words')
  redirect(`/teacher/words/sets/${newSet.id}`)
}

// ─── 보충 세트 생성 (오답 단어만) ────────────────────────────────────────────────

export async function createSupplementarySet(
  assignmentId: string,
  studentId: string,
): Promise<{ error?: string; setId?: string }> {
  const teacher = await getAuthedTeacher()
  if (!teacher) return { error: '인증이 필요합니다.' }

  const attempt = await prisma.wordTestAttempt.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    select: { answers: true, assignment: { select: { title: true, setId: true } } },
  })
  if (!attempt) return { error: '응시 기록이 없습니다.' }

  const answers = attempt.answers as { wordId: string; isCorrect: boolean }[]
  const wrongWordIds = answers.filter((a) => !a.isCorrect).map((a) => a.wordId)
  if (wrongWordIds.length === 0) return { error: '오답이 없습니다.' }

  const newSet = await prisma.$transaction(async (tx) => {
    const set = await tx.wordSet.create({
      data: {
        title: `[보충] ${attempt.assignment.title}`,
        cefrLevel: 1,
        isPublic: false,
        source: 'AI_GENERATED',
        ownerId: teacher.id,
        academyId: teacher.academyId!,
      },
    })
    await tx.wordSetItem.createMany({
      data: wrongWordIds.map((wordId, i) => ({ setId: set.id, wordId, order: i })),
    })
    return set
  })

  revalidatePath(`/teacher/words/sets`)
  return { setId: newSet.id }
}
