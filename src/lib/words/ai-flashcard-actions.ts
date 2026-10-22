'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { ACTIVITY_ACTIONS } from '@/lib/constants/activity-actions'
import { mapOxfordCefrToWegoupLevel } from '@/lib/words/cefr-mapping'
import {
  FLASHCARD_MAX_WORDS,
  FLASHCARD_MEANING_MAX_LENGTH,
  FLASHCARD_TERM_MAX_LENGTH,
} from '@/lib/words/flashcard-text-parser'
import { generateFlashcards, FLASHCARD_PARTS_OF_SPEECH, type FlashcardCefr } from '@/lib/openai/flashcard-generation'
import { getFlashcardQuota, recordFlashcardUsage } from '@/lib/usage/flashcard-usage'
import {
  getStudentFlashcardQuota,
  isStudentAiFlashcardEnabled,
  recordStudentFlashcardUsage,
} from '@/lib/student-credits/wallet'
import type { AiFlashcardCard, AiFlashcardQuotaView } from '@/types/ai-flashcard'

const OXFORD_CEFR = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

type Creator =
  | { kind: 'STAFF'; id: string; academyId: string; role: 'TEACHER' | 'ACADEMY_OWNER' }
  | { kind: 'STUDENT'; id: string; academyId: string; role: 'STUDENT'; studentId: string }

/**
 * AI 플래시카드를 만들 수 있는 사용자.
 * 교사·학원장은 학원 요금제(무료 한도 → 학원 크레딧)로, 학생은 학생 결제를 허용한 학원(위고업잉글리시)에서만
 * 학생 개인 무료 한도 → 학생 크레딧으로 과금한다.
 */
async function getAuthedCreator(): Promise<Creator | null> {
  const user = await getCurrentUser()
  if (!user || !user.academyId) return null
  if (user.role === 'TEACHER' || user.role === 'ACADEMY_OWNER') {
    return { kind: 'STAFF', id: user.id, academyId: user.academyId, role: user.role }
  }
  if (user.role === 'STUDENT' && user.student && (await isStudentAiFlashcardEnabled(user.academyId))) {
    return { kind: 'STUDENT', id: user.id, academyId: user.academyId, role: 'STUDENT', studentId: user.student.id }
  }
  return null
}

function basePathOf(role: Creator['role']): string {
  if (role === 'STUDENT') return '/student/words'
  return role === 'TEACHER' ? '/teacher/words' : '/owner/words'
}

async function quotaOf(creator: Creator): Promise<AiFlashcardQuotaView> {
  if (creator.kind === 'STAFF') return toQuotaView(await getFlashcardQuota(creator.academyId))
  const q = await getStudentFlashcardQuota(creator.studentId)
  return {
    usedThisMonth: q.usedFreeThisMonth,
    freeLimit: q.freeLimit,
    remainingFree: q.remainingFree,
    creditBalance: q.creditBalance,
    creditPerWord: q.creditPerWord,
    maxWords: q.maxWords,
    blocked: false,
  }
}

/** 위고업 단계(1~10) → Oxford CEFR (AI 난이도 힌트) */
function levelToOxfordCefr(level: number): FlashcardCefr {
  const idx = Math.min(5, Math.max(1, Math.ceil(level / 2)))
  return OXFORD_CEFR[idx - 1]
}

function toQuotaView(q: Awaited<ReturnType<typeof getFlashcardQuota>>): AiFlashcardQuotaView {
  return {
    usedThisMonth: q.usedThisMonth,
    freeLimit: q.freeLimit,
    remainingFree: Number.isFinite(q.remainingFree) ? q.remainingFree : null,
    creditBalance: q.creditBalance,
    creditPerWord: q.creditPerWord,
    maxWords: Number.isFinite(q.maxWords) ? q.maxWords : null,
    blocked: q.blocked,
  }
}

// ─── 남은 한도 ─────────────────────────────────────────────────────────────────

export async function getAiFlashcardQuota(): Promise<AiFlashcardQuotaView | null> {
  const creator = await getAuthedCreator()
  if (!creator) return null
  return quotaOf(creator)
}

// ─── AI 생성 ──────────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  entries: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(FLASHCARD_TERM_MAX_LENGTH),
        meaning: z.string().trim().max(FLASHCARD_MEANING_MAX_LENGTH).nullable(),
      }),
    )
    .min(1, '단어를 1개 이상 입력하세요.')
    .max(FLASHCARD_MAX_WORDS, `한 번에 최대 ${FLASHCARD_MAX_WORDS}개까지 만들 수 있습니다.`),
  /** 세트 레벨(1~10) — AI 난이도 힌트, null이면 단어별로 AI가 판단 */
  cefrLevel: z.number().int().min(1).max(10).nullable(),
  /** 공용 사전에 있는 단어는 사전 내용을 그대로 사용 (AI·크레딧 사용 안 함) */
  useDictionary: z.boolean().default(true),
})

export type GenerateAiFlashcardsResult =
  | {
      ok: true
      cards: AiFlashcardCard[]
      /** AI가 만들지 못한 단어 */
      failedTerms: string[]
      aiCount: number
      dictionaryCount: number
      freeCount: number
      creditsUsed: number
      quota: AiFlashcardQuotaView
    }
  | { ok: false; error: string; quota?: AiFlashcardQuotaView }

export async function generateAiFlashcards(input: z.input<typeof GenerateSchema>): Promise<GenerateAiFlashcardsResult> {
  const user = await getAuthedCreator()
  if (!user) return { ok: false, error: '인증이 필요합니다.' }

  const parsed = GenerateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? '입력 오류' }
  const { entries, cefrLevel, useDictionary } = parsed.data

  // 1) 뜻을 적지 않은 단어 중 공용 사전에 있는 단어는 사전 내용 사용
  const dictionaryByTerm = new Map<string, AiFlashcardCard>()
  if (useDictionary) {
    const terms = entries.filter((e) => !e.meaning).map((e) => e.term)
    if (terms.length > 0) {
      const found = await prisma.word.findMany({
        where: { academyId: null, meaning: { not: null }, term: { in: terms, mode: 'insensitive' } },
        select: { id: true, term: true, partOfSpeech: true, oxfordCefr: true, meaning: true, definition: true, example: true },
        orderBy: [{ cefrLevel: 'asc' }, { homonymIndex: { sort: 'asc', nulls: 'first' } }],
      })
      for (const w of found) {
        const key = w.term.toLowerCase()
        if (dictionaryByTerm.has(key)) continue
        dictionaryByTerm.set(key, {
          wordId: w.id,
          term: w.term,
          partOfSpeech: w.partOfSpeech,
          meaning: w.meaning ?? '',
          definition: w.definition ?? '',
          example: w.example ?? '',
          oxfordCefr: w.oxfordCefr,
          origin: 'DICTIONARY',
        })
      }
    }
  }

  const aiEntries = entries.filter((e) => e.meaning || !dictionaryByTerm.has(e.term.toLowerCase()))

  // 2) 한도 확인 — AI로 만들 단어 수만큼 무료 한도 + 크레딧이 있어야 한다
  const quota = await quotaOf(user)
  if (aiEntries.length > 0) {
    if (quota.blocked) {
      return { ok: false, error: '결제 실패로 AI 사용이 차단되었습니다. 결제 수단을 갱신해주세요.', quota }
    }
    if (quota.maxWords !== null && aiEntries.length > quota.maxWords) {
      const free = quota.remainingFree ?? 0
      return {
        ok: false,
        error: `AI로 만들 단어가 ${aiEntries.length}개인데 지금은 ${quota.maxWords}개(이번 달 무료 ${free}개 + 크레딧 ${quota.maxWords - free}개)까지 만들 수 있습니다. 크레딧을 충전하거나 단어 수를 줄여주세요.`,
        quota,
      }
    }
  }

  // 3) AI 생성
  let generated: Awaited<ReturnType<typeof generateFlashcards>> = []
  if (aiEntries.length > 0) {
    try {
      generated = await generateFlashcards(aiEntries, cefrLevel ? levelToOxfordCefr(cefrLevel) : null)
    } catch (e) {
      console.error('[ai-flashcard] 생성 실패', e)
      return { ok: false, error: 'AI 플래시카드를 만들지 못했습니다. 잠시 후 다시 시도해주세요.', quota }
    }
  }
  const aiByTerm = new Map<string, AiFlashcardCard | null>()
  aiEntries.forEach((e, i) => {
    const g = generated[i]
    aiByTerm.set(e.term.toLowerCase(), g ? { wordId: null, ...g, origin: 'AI' } : null)
  })

  const cards: AiFlashcardCard[] = []
  const failedTerms: string[] = []
  for (const e of entries) {
    const key = e.term.toLowerCase()
    const card = aiByTerm.has(key) ? aiByTerm.get(key) : dictionaryByTerm.get(key)
    if (card) cards.push(card)
    else failedTerms.push(e.term)
  }

  // 4) 과금 — 실제로 만든 단어만
  const aiCount = cards.filter((c) => c.origin === 'AI').length
  const { freeCount, creditsUsed } =
    user.kind === 'STAFF'
      ? await recordFlashcardUsage({ academyId: user.academyId, userId: user.id, wordCount: aiCount })
      : await recordStudentFlashcardUsage(user.studentId, aiCount)

  return {
    ok: true,
    cards,
    failedTerms,
    aiCount,
    dictionaryCount: cards.length - aiCount,
    freeCount,
    creditsUsed,
    quota: await quotaOf(user),
  }
}

// ─── 세트 저장 ─────────────────────────────────────────────────────────────────

const CardSchema = z.object({
  /** 사전 단어를 고치지 않고 그대로 쓰면 그 단어 id */
  wordId: z.string().uuid().nullable(),
  term: z.string().trim().min(1, '단어를 입력하세요.').max(FLASHCARD_TERM_MAX_LENGTH),
  partOfSpeech: z.string().trim().min(1).max(20),
  meaning: z.string().trim().min(1, '뜻을 입력하세요.').max(FLASHCARD_MEANING_MAX_LENGTH),
  definition: z.string().trim().max(300),
  example: z.string().trim().max(300),
  oxfordCefr: z.enum(OXFORD_CEFR),
})

const SaveSchema = z.object({
  title: z.string().trim().min(1, '세트 이름을 입력하세요.').max(100),
  description: z.string().trim().max(300).optional(),
  cefrLevel: z.number().int().min(1).max(10),
  cards: z
    .array(CardSchema)
    .min(1, '카드를 1개 이상 남겨주세요.')
    .max(FLASHCARD_MAX_WORDS, `한 세트에 최대 ${FLASHCARD_MAX_WORDS}개까지 저장할 수 있습니다.`),
  assignedStudentIds: z.array(z.string().uuid()).default([]),
})

/** 세트 이름에 붙일 생성 날짜 접미사 (기존 세트 만들기와 동일) */
function setCreationDateSuffix(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `(${y}-${m}-${day})`
}

export async function saveAiFlashcardSet(
  input: z.input<typeof SaveSchema>,
): Promise<{ ok: true; setId: string; redirectTo: string } | { ok: false; error: string }> {
  const user = await getAuthedCreator()
  if (!user) return { ok: false, error: '인증이 필요합니다.' }

  const parsed = SaveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? '입력 오류' }
  const { title, description, cefrLevel, cards, assignedStudentIds } = parsed.data
  const academyId = user.academyId

  // 사전 단어 id는 공용 또는 우리 학원 단어만
  const givenIds = Array.from(new Set(cards.flatMap((c) => (c.wordId ? [c.wordId] : []))))
  const validIds = new Set(
    givenIds.length > 0
      ? (
          await prisma.word.findMany({
            where: { id: { in: givenIds }, OR: [{ academyId: null }, { academyId }] },
            select: { id: true },
          })
        ).map((w) => w.id)
      : [],
  )

  // 배정 학생은 우리 학원 학생만
  const studentIds =
    user.kind === 'STAFF' && assignedStudentIds.length > 0
      ? (
          await prisma.student.findMany({
            where: { id: { in: assignedStudentIds }, user: { academyId, isDeleted: false } },
            select: { id: true },
          })
        ).map((s) => s.id)
      : []

  // 같은 학원에 이미 같은 단어·품사·뜻으로 만든 전용 단어가 있으면 다시 쓴다 (학습 기록 이어짐)
  const newCards = cards.filter((c) => !c.wordId || !validIds.has(c.wordId))
  const existingPrivate =
    newCards.length > 0
      ? await prisma.word.findMany({
          where: { academyId, term: { in: newCards.map((c) => c.term), mode: 'insensitive' } },
          select: { id: true, term: true, partOfSpeech: true, meaning: true },
        })
      : []
  const privateKey = (term: string, pos: string, meaning: string) => `${term.toLowerCase()}|${pos}|${meaning}`
  const privateIdByKey = new Map(existingPrivate.map((w) => [privateKey(w.term, w.partOfSpeech, w.meaning ?? ''), w.id]))

  const partsOfSpeech: readonly string[] = FLASHCARD_PARTS_OF_SPEECH
  const dateSuffix = setCreationDateSuffix()

  const set = await prisma.$transaction(
    async (tx) => {
      const wordIds: string[] = []
      for (const c of cards) {
        if (c.wordId && validIds.has(c.wordId)) {
          wordIds.push(c.wordId)
          continue
        }
        const pos = partsOfSpeech.includes(c.partOfSpeech) ? c.partOfSpeech : c.term.includes(' ') ? 'phrase' : 'n'
        const key = privateKey(c.term, pos, c.meaning)
        const existingId = privateIdByKey.get(key)
        if (existingId) {
          await tx.word.update({
            where: { id: existingId },
            data: { definition: c.definition || null, example: c.example || null },
          })
          wordIds.push(existingId)
          continue
        }
        const word = await tx.word.create({
          data: {
            term: c.term,
            partOfSpeech: pos,
            cefrLevel: mapOxfordCefrToWegoupLevel(c.oxfordCefr),
            oxfordCefr: c.oxfordCefr,
            meaning: c.meaning,
            definition: c.definition || null,
            example: c.example || null,
            source: 'AI_GENERATED',
            academyId,
          },
          select: { id: true },
        })
        privateIdByKey.set(key, word.id)
        wordIds.push(word.id)
      }

      const uniqueWordIds = Array.from(new Set(wordIds))
      // 학생이 만든 세트는 학생 본인만 보는 개인 세트 (학원 세트 목록에는 나오지 않도록 academyId 없음)
      const created = await tx.wordSet.create({
        data: {
          title: `${title} ${dateSuffix}`,
          description: description || 'AI 플래시카드로 만든 세트',
          cefrLevel,
          isPublic: false,
          source: user.kind === 'STUDENT' ? 'STUDENT' : 'AI_GENERATED',
          ownerId: user.id,
          academyId: user.kind === 'STUDENT' ? null : academyId,
        },
        select: { id: true },
      })
      await tx.wordSetItem.createMany({
        data: uniqueWordIds.map((wordId, i) => ({ setId: created.id, wordId, order: i })),
      })
      if (studentIds.length > 0) {
        await tx.wordSetAssignment.createMany({
          data: studentIds.map((studentId) => ({ setId: created.id, studentId })),
          skipDuplicates: true,
        })
      }
      return created
    },
    { timeout: 20_000 },
  )

  await logActivity({
    userId: user.id,
    role: user.role,
    academyId,
    action: ACTIVITY_ACTIONS.WORD_SET_CREATE,
    metadata: { setId: set.id, aiFlashcard: true, wordCount: cards.length, studentCount: studentIds.length },
  })

  const base = basePathOf(user.role)
  revalidatePath(base)
  revalidatePath('/student/words')
  // 학생 세트 화면은 /student/words/{id}, 교사·학원장은 /…/words/sets/{id}
  const redirectTo = user.kind === 'STUDENT' ? `${base}/${set.id}` : `${base}/sets/${set.id}`
  return { ok: true, setId: set.id, redirectTo }
}
