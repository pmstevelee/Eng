'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma/client'
import { createClient } from '@/lib/supabase/server'
import { mapOxfordCefrToWegoupLevel } from '@/lib/words/cefr-mapping'
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

/**
 * 위고업 단계(1~10) → Oxford CEFR(A1~C1) 매핑.
 * Level 1·2 → A1, 3·4 → A2, 5·6 → B1, 7·8 → B2, 9·10 → C1
 * (단어 DB의 cefrLevel ↔ oxfordCefr 대응: A1=L2, A2=L4, B1=L6, B2=L8, C1=L10)
 */
function levelToOxfordCefr(level: number): OxfordCefrValue {
  const idx = Math.min(5, Math.max(1, Math.ceil(level / 2)))
  return OXFORD_CEFR_VALUES[idx - 1]
}

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

// ─── 자동 생성: 일자별 세트 일괄 생성 ────────────────────────────────────────────

const AutoCreateDailySetsSchema = z.object({
  titleBase: z.string().min(1, '세트 이름을 입력하세요.').max(80),
  description: z.string().max(300).optional(),
  cefrLevel: z.coerce.number().int().min(1).max(10),
  cefrLevels: z.array(z.enum(OXFORD_CEFR_VALUES)).default([]),
  perDay: z.coerce.number().int().min(1).max(200),
  totalDays: z.coerce.number().int().min(1).max(120),
  order: z.enum(['recommended', 'random']).default('recommended'),
})

/**
 * 기간 조건으로 "일자별" 단어 세트를 한 번에 생성한다.
 * 예) 하루 20개 × 7일 → "{이름} 1일차" ~ "{이름} 7일차" 7개 세트 (각 20개)
 * 단어가 부족하면 채울 수 있는 일자까지만 생성한다.
 */
export async function autoCreateDailySets(
  input: z.infer<typeof AutoCreateDailySetsSchema>,
): Promise<{ error?: string; createdSets?: number }> {
  const teacher = await getAuthedTeacher()
  if (!teacher) return { error: '인증이 필요합니다.' }

  const parsed = AutoCreateDailySetsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? '입력 오류' }

  const { titleBase, description, cefrLevel, cefrLevels, perDay, totalDays, order } = parsed.data

  // 레벨 칩을 선택하지 않았으면 세트의 위고업 단계에 맞춰 자동 보정
  const effectiveLevels = cefrLevels.length > 0 ? cefrLevels : [levelToOxfordCefr(cefrLevel)]

  const need = perDay * totalDays
  const where = buildAutoWhere(effectiveLevels, [])

  // 필요한 만큼 단어 id 선택 (추천순 / 무작위)
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

  // 하루치(perDay)씩 묶기 — 최대 totalDays개, 단어가 있는 일자만 생성
  const chunks: string[][] = []
  for (let i = 0; i < wordIds.length && chunks.length < totalDays; i += perDay) {
    chunks.push(wordIds.slice(i, i + perDay))
  }

  const multiDay = chunks.length > 1

  // 세트 id를 미리 생성해 두고 createMany 2번으로 일괄 삽입
  // (일자 수가 많아도 트랜잭션이 길어지지 않도록 — interactive transaction 타임아웃 방지)
  const savedCefrLevel = mapOxfordCefrToWegoupLevel(effectiveLevels[0])
  const setsData = chunks.map((_, d) => ({
    id: randomUUID(),
    title: multiDay ? `${titleBase} ${d + 1}일차` : titleBase,
    description: description ?? null,
    cefrLevel: savedCefrLevel,
    isPublic: false,
    source: 'TEACHER' as const,
    ownerId: teacher.id,
    academyId: teacher.academyId!,
  }))
  const itemsData = chunks.flatMap((chunk, d) =>
    chunk.map((wordId, i) => ({ setId: setsData[d].id, wordId, order: i })),
  )

  await prisma.$transaction([
    prisma.wordSet.createMany({ data: setsData }),
    prisma.wordSetItem.createMany({ data: itemsData }),
  ])

  revalidatePath('/teacher/words')
  redirect('/teacher/words')
}

// ─── 세트 삭제 ──────────────────────────────────────────────────────────────────

export async function deleteTeacherWordSet(
  setId: string,
): Promise<{ error?: string }> {
  const teacher = await getAuthedTeacher()
  if (!teacher) return { error: '인증이 필요합니다.' }

  const wordSet = await prisma.wordSet.findFirst({
    where: { id: setId, academyId: teacher.academyId! },
    select: { id: true, source: true, ownerId: true },
  })
  if (!wordSet) return { error: '세트를 찾을 수 없습니다.' }
  if (wordSet.source === 'PUBLISHER') return { error: '시스템 기본 세트는 삭제할 수 없습니다.' }
  if (wordSet.ownerId !== teacher.id) return { error: '내가 만든 세트만 삭제할 수 있습니다.' }

  await prisma.$transaction([
    prisma.wordSetItem.deleteMany({ where: { setId } }),
    prisma.wordSet.delete({ where: { id: setId } }),
  ])

  revalidatePath('/teacher/words')
  return {}
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
