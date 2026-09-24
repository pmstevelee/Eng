import 'server-only'

import { randomBytes } from 'crypto'
import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma/client'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import type { AdaptiveNextResult } from '@/app/(dashboard)/student/tests/[sessionId]/adaptive-actions'
import {
  buildPlacementResult,
  calculateDomainLevel,
  calculateOverallLevel,
  estimateCurrentLevel,
  getTargetDifficulty,
  getWritingPromptByLevel,
  selectNextAdaptiveQuestion,
  shouldEndDomain,
  type AdaptiveConfig,
  type AdaptiveDomain,
  type QuestionHistoryItem,
} from '@/lib/assessment/adaptive-test-engine'
import { gradeAdaptiveResponse, gradeAdaptiveWriting, recordAdaptiveUsage } from '@/lib/assessment/adaptive-grading'
import { getUsedLevelTestQuestions } from '@/lib/questions/usage-tracker'

// 비회원(문의) 레벨테스트 진행기
// - 문제 선정·채점·레벨 산출은 기존 적응형 엔진 함수를 그대로 사용한다.
// - 로그인 없는 공개 응시이므로 응답 이력·채점은 서버에만 두고, 클라이언트가 보낸 정오답은 신뢰하지 않는다.
// - 현재 출제 문항(pending)에 대한 답만 받아 문항 건너뛰기·중복 제출을 막는다.

/** 학생 응시 기본값과 동일 */
const CONFIG: AdaptiveConfig = {
  questionsPerDomain: 8,
  startLevel: 5,
  writingQuestions: 2,
}
const DOMAIN_ORDER: AdaptiveDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'WRITING']
const OBJECTIVE_DOMAINS: AdaptiveDomain[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING']

/** 응시 링크 만료 후에도 진행 중인 응시는 이 시간까지 마칠 수 있음 */
const IN_PROGRESS_GRACE_MS = 24 * 60 * 60 * 1000
export const INVITE_VALID_DAYS = 7
export const RESULT_VALID_DAYS = 30

type HistoryEntry = QuestionHistoryItem & { answer: string }

type Pending =
  | {
      kind: 'question'
      questionId: string
      domain: AdaptiveDomain
      difficulty: number
      domainQuestionIndex: number
      estimatedLevel: number
      /** 문항 본문 (서버 전용 — 채점·재출제 시 재조회 생략, 클라이언트에는 정답 제거 후 전달) */
      content?: Prisma.JsonValue
    }
  | {
      kind: 'writing'
      index: number
      estimatedLevel: number
      promptText: string
      wordRange: string
      isLastQuestion: boolean
    }

/** 마지막 쓰기 제출 후 채점 중 / 완료 (JSON null 대신 명시적 상태로 저장) */
type PendingState = Pending | { kind: 'grading' } | { kind: 'done' }

function readPending(v: Prisma.JsonValue): PendingState | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const kind = (v as Record<string, unknown>).kind
  return kind === 'question' || kind === 'writing' || kind === 'grading' || kind === 'done'
    ? (v as unknown as PendingState)
    : null
}

/** URL용 추측 불가능 토큰 (192비트) */
export function generateToken(): string {
  return randomBytes(24).toString('base64url')
}

// ─── 초대 상태 확인 ────────────────────────────────────────────────────────────

export type InviteState =
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'completed'; studentName: string; academyName: string }
  | {
      kind: 'ready'
      inviteId: string
      studentName: string
      academyName: string
      started: boolean
      expiresAt: Date
    }

const INVITE_SELECT = {
  id: true,
  status: true,
  expiresAt: true,
  academyId: true,
  leadId: true,
  attemptId: true,
  attempt: {
    select: {
      id: true,
      status: true,
      history: true,
      pending: true,
      writingAnswers: true,
      updatedAt: true,
    },
  },
  lead: { select: { studentName: true, assigneeId: true } },
  academy: {
    select: {
      name: true,
      businessName: true,
      branchName: true,
      parentAcademyId: true,
      ownerId: true,
      parentAcademy: {
        select: { name: true, businessName: true, phone: true },
      },
      phone: true,
    },
  },
} satisfies Prisma.PlacementInviteSelect

type InviteRow = Prisma.PlacementInviteGetPayload<{
  select: typeof INVITE_SELECT
}>

export function academyNameOf(a: InviteRow['academy']): string {
  const base = a.businessName ?? a.parentAcademy?.businessName ?? a.parentAcademy?.name ?? a.name
  return a.parentAcademyId && a.branchName ? `${base} ${a.branchName}` : base
}

function isUsable(invite: InviteRow, now = Date.now()): boolean {
  if (invite.status === 'SENT') return invite.expiresAt.getTime() > now
  if (invite.status === 'STARTED') return invite.expiresAt.getTime() + IN_PROGRESS_GRACE_MS > now
  return false
}

async function findInvite(token: string): Promise<InviteRow | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  return prisma.placementInvite.findUnique({
    where: { token },
    select: INVITE_SELECT,
  })
}

/** 공개 페이지용 초대 상태 (토큰으로만 조회) */
export async function getInviteState(token: string): Promise<InviteState> {
  const invite = await findInvite(token)
  if (!invite) return { kind: 'not_found' }
  const academyName = academyNameOf(invite.academy)
  if (invite.status === 'COMPLETED')
    return {
      kind: 'completed',
      studentName: invite.lead.studentName,
      academyName,
    }
  if (!isUsable(invite)) {
    if (invite.status !== 'EXPIRED') {
      await prisma.placementInvite.updateMany({
        where: { id: invite.id, status: { in: ['SENT', 'STARTED'] } },
        data: { status: 'EXPIRED' },
      })
    }
    return { kind: 'expired' }
  }
  return {
    kind: 'ready',
    inviteId: invite.id,
    studentName: invite.lead.studentName,
    academyName,
    started: invite.status === 'STARTED',
    expiresAt: invite.expiresAt,
  }
}

// ─── 진행 ─────────────────────────────────────────────────────────────────────

type AttemptRow = {
  id: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  history: Prisma.JsonValue
  pending: Prisma.JsonValue
  writingAnswers: Prisma.JsonValue
  updatedAt: Date
}

const ATTEMPT_SELECT = {
  id: true,
  status: true,
  history: true,
  pending: true,
  writingAnswers: true,
  updatedAt: true,
} as const

type Context = { invite: InviteRow; attempt: AttemptRow }

const EXPIRED_ERROR: AdaptiveNextResult = {
  type: 'error',
  error: '응시 기간이 지났거나 이미 완료된 레벨테스트입니다.',
}

/** 토큰 → 진행 가능한 응시 (없으면 최초 1회 생성) */
async function loadContext(token: string, createIfMissing: boolean): Promise<Context | null> {
  const invite = await findInvite(token)
  if (!invite || !isUsable(invite)) return null

  if (invite.attempt) {
    if (invite.attempt.status !== 'IN_PROGRESS') return null
    return { invite, attempt: invite.attempt }
  }
  if (!createIfMissing) return null

  // 동시에 두 번 시작해도 응시 기록은 하나만 생성
  const attempt = await prisma.$transaction(async (tx) => {
    const claimed = await tx.placementInvite.updateMany({
      where: { id: invite.id, status: 'SENT', attemptId: null },
      data: { status: 'STARTED' },
    })
    if (claimed.count === 0) return null
    const created = await tx.placementAttempt.create({
      data: { academyId: invite.academyId, leadId: invite.leadId },
      select: ATTEMPT_SELECT,
    })
    await tx.placementInvite.update({
      where: { id: invite.id },
      data: { attemptId: created.id },
    })
    await tx.lead.update({
      where: { id: invite.leadId },
      data: { lastActivityAt: new Date() },
    })
    return created
  })
  if (attempt) return { invite, attempt }
  return loadContext(token, false)
}

function readHistory(v: Prisma.JsonValue): HistoryEntry[] {
  return Array.isArray(v) ? (v as unknown as HistoryEntry[]) : []
}
function readWriting(v: Prisma.JsonValue): string[] {
  return Array.isArray(v) ? (v as unknown as string[]) : []
}

async function exclusionsFor(academyId: string) {
  // 비회원은 풀이 이력이 없으므로 학원 1년 레벨테스트 사용 이력만 반영
  return {
    studentSeenIds: [] as string[],
    academyUsedIds: await getUsedLevelTestQuestions(academyId),
  }
}

function writingPending(history: HistoryEntry[]): Pending {
  const estimatedLevel = Math.round(
    calculateOverallLevel(
      OBJECTIVE_DOMAINS.map((d) =>
        calculateDomainLevel(
          history.filter((h) => h.domain === d),
          CONFIG.startLevel,
        ),
      ),
    ),
  )
  const prompt = getWritingPromptByLevel(estimatedLevel)
  return {
    kind: 'writing',
    index: 1,
    estimatedLevel,
    promptText: prompt.prompt,
    wordRange: prompt.wordRange,
    isLastQuestion: CONFIG.writingQuestions === 1,
  }
}

/** 이력으로 다음 출제 문항 결정 (학생 응시의 영역 진행 규칙과 동일) — 선정 시 조회한 본문을 pending에 보관 */
async function resolveNext(history: HistoryEntry[], academyId: string): Promise<Pending> {
  const exclusions = await exclusionsFor(academyId)
  const usedIds = history.map((h) => h.questionId)

  if (history.length === 0) {
    const q = await selectNextAdaptiveQuestion('GRAMMAR', CONFIG.startLevel, [], academyId, exclusions)
    if (q) {
      return {
        kind: 'question',
        questionId: q.questionId,
        domain: 'GRAMMAR',
        difficulty: q.difficulty,
        domainQuestionIndex: 1,
        estimatedLevel: CONFIG.startLevel,
        content: q.contentJson as Prisma.JsonValue,
      }
    }
  }

  const current = history.length > 0 ? history[history.length - 1].domain : 'GRAMMAR'
  const domainHistory = history.filter((h) => h.domain === current)
  const estimate = estimateCurrentLevel(domainHistory, CONFIG.startLevel)

  if (history.length > 0 && !shouldEndDomain(domainHistory, CONFIG, current)) {
    const target = getTargetDifficulty(domainHistory, estimate)
    const q = await selectNextAdaptiveQuestion(current, target, usedIds, academyId, exclusions)
    if (q) {
      return {
        kind: 'question',
        questionId: q.questionId,
        domain: current,
        difficulty: q.difficulty,
        domainQuestionIndex: domainHistory.length + 1,
        estimatedLevel: estimate,
        content: q.contentJson as Prisma.JsonValue,
      }
    }
  }

  // 다음 영역 (문제가 없는 영역은 건너뜀, 객관식이 끝나면 쓰기)
  for (const next of DOMAIN_ORDER.slice(DOMAIN_ORDER.indexOf(current) + 1)) {
    if (next === 'WRITING') break
    const q = await selectNextAdaptiveQuestion(next, Math.round(estimate), usedIds, academyId, exclusions)
    if (q) {
      return {
        kind: 'question',
        questionId: q.questionId,
        domain: next,
        difficulty: q.difficulty,
        domainQuestionIndex: 1,
        estimatedLevel: estimate,
        content: q.contentJson as Prisma.JsonValue,
      }
    }
  }
  return writingPending(history)
}

const ANSWER_KEYS = new Set(['correct_answer', 'correctAnswer', 'explanation', 'answer_explanation'])

/** 공개 응시 화면으로 보내는 문항에서 정답·해설 제거 (채점은 서버에서만 수행) */
function stripAnswers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripAnswers)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !ANSWER_KEYS.has(k))
        .map(([k, v]) => [k, stripAnswers(v)]),
    )
  }
  return value
}

/** pending → 클라이언트 응답 (본문이 보관돼 있지 않을 때만 조회) */
async function toResult(pending: PendingState): Promise<AdaptiveNextResult> {
  // 채점 중(동시 제출)·완료 → 응시자에게는 완료 화면
  if (pending.kind === 'grading' || pending.kind === 'done') return { type: 'complete' }
  if (pending.kind === 'writing') {
    return {
      type: 'writing_prompt',
      domain: 'WRITING',
      promptText: pending.promptText,
      wordRange: pending.wordRange,
      questionIndex: pending.index,
      isLastQuestion: pending.isLastQuestion,
    }
  }
  const contentJson =
    pending.content ??
    (
      await prisma.question.findUnique({
        where: { id: pending.questionId },
        select: { contentJson: true },
      })
    )?.contentJson
  if (!contentJson)
    return {
      type: 'error',
      error: '문제를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
    }
  return {
    type: 'question',
    questionId: pending.questionId,
    domain: pending.domain,
    difficulty: pending.difficulty,
    contentJson: stripAnswers(contentJson) as QuestionContentJson,
    domainQuestionIndex: pending.domainQuestionIndex,
    domainTotalEstimate: CONFIG.questionsPerDomain,
    currentDomain: pending.domain,
    domainOrder: DOMAIN_ORDER,
    estimatedLevel: pending.estimatedLevel,
  }
}

/** 낙관적 잠금으로 진행 상태 저장 — 동시 제출이면 false */
async function saveProgress(attempt: AttemptRow, data: Prisma.PlacementAttemptUpdateManyMutationInput) {
  const res = await prisma.placementAttempt.updateMany({
    where: {
      id: attempt.id,
      status: 'IN_PROGRESS',
      updatedAt: attempt.updatedAt,
    },
    data,
  })
  return res.count === 1
}

/** 시작 또는 이어하기 — 현재 출제 문항 반환 */
export async function startPlacement(token: string): Promise<AdaptiveNextResult> {
  const ctx = await loadContext(token, true)
  if (!ctx) return EXPIRED_ERROR

  const current = readPending(ctx.attempt.pending)
  if (current) return toResult(current)

  const history = readHistory(ctx.attempt.history)
  const next = await resolveNext(history, ctx.invite.academyId)
  await saveProgress(ctx.attempt, {
    pending: next as unknown as Prisma.InputJsonValue,
  })
  return toResult(next)
}

/** 객관식 답안 제출 → 다음 문항 */
export async function answerPlacementQuestion(
  token: string,
  questionId: string,
  answer: string,
): Promise<AdaptiveNextResult> {
  const ctx = await loadContext(token, false)
  if (!ctx) return EXPIRED_ERROR

  const pending = readPending(ctx.attempt.pending)
  // 현재 문항이 아니면(중복 제출·새로고침) 현재 출제 문항을 다시 돌려준다
  if (!pending || pending.kind !== 'question' || pending.questionId !== questionId) {
    return pending ? toResult(pending) : startPlacement(token)
  }

  const content =
    pending.content ??
    (
      await prisma.question.findUnique({
        where: { id: questionId },
        select: { contentJson: true },
      })
    )?.contentJson
  const isCorrect = content ? (gradeAdaptiveResponse(content as QuestionContentJson, answer) ?? false) : false

  const history = [
    ...readHistory(ctx.attempt.history),
    {
      questionId,
      difficulty: pending.difficulty,
      domain: pending.domain,
      isCorrect,
      answer: answer.slice(0, 2000),
    },
  ]
  const next = await resolveNext(history, ctx.invite.academyId)
  const saved = await saveProgress(ctx.attempt, {
    history: history as unknown as Prisma.InputJsonValue,
    pending: next as unknown as Prisma.InputJsonValue,
  })
  if (!saved) return startPlacement(token)
  return toResult(next)
}

/** 쓰기 답안 제출 → 다음 쓰기 문항 또는 최종 채점 */
export async function answerPlacementWriting(
  token: string,
  questionIndex: number,
  text: string,
): Promise<AdaptiveNextResult> {
  const ctx = await loadContext(token, false)
  if (!ctx) return EXPIRED_ERROR

  const pending = readPending(ctx.attempt.pending)
  if (!pending || pending.kind !== 'writing' || pending.index !== questionIndex) {
    return pending ? toResult(pending) : startPlacement(token)
  }

  const writingAnswers = readWriting(ctx.attempt.writingAnswers)
  writingAnswers[questionIndex - 1] = text.slice(0, 5000)

  if (questionIndex < CONFIG.writingQuestions) {
    const prompt = getWritingPromptByLevel(pending.estimatedLevel)
    const next: Pending = {
      kind: 'writing',
      index: questionIndex + 1,
      estimatedLevel: pending.estimatedLevel,
      promptText: `[에세이] ${prompt.prompt}`,
      wordRange: prompt.wordRange,
      isLastQuestion: questionIndex + 1 >= CONFIG.writingQuestions,
    }
    const saved = await saveProgress(ctx.attempt, {
      writingAnswers,
      pending: next as unknown as Prisma.InputJsonValue,
    })
    if (!saved) return startPlacement(token)
    return toResult(next)
  }

  // 마지막 쓰기 → 먼저 '채점 중'으로 바꿔 채점 동안의 중복 제출을 차단
  const locked = await saveProgress(ctx.attempt, {
    writingAnswers,
    pending: { kind: 'grading' },
  })
  if (!locked) return startPlacement(token)
  await finalizePlacement(ctx, readHistory(ctx.attempt.history), writingAnswers)
  return { type: 'complete' }
}

// ─── 최종 채점 ─────────────────────────────────────────────────────────────────

/** 학생 응시의 finalizeAdaptiveTestWithWriting과 같은 산출 방식 (이전 레벨 없음) */
async function finalizePlacement(ctx: Context, history: HistoryEntry[], writingAnswers: string[]) {
  const { invite, attempt } = ctx

  const listeningMeasured =
    history.filter((h) => h.domain === 'LISTENING').length >= (CONFIG.minListeningQuestions ?? 3)
  const objDomains: AdaptiveDomain[] = listeningMeasured
    ? ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING']
    : ['GRAMMAR', 'VOCABULARY', 'READING']
  const objResults = objDomains.map((d) =>
    calculateDomainLevel(
      history.filter((h) => h.domain === d),
      CONFIG.startLevel,
    ),
  )
  const objOverall = calculateOverallLevel(objResults)

  const aiWriting = await gradeAdaptiveWriting(writingAnswers, objOverall, invite.academyId)
  const writingLevel = aiWriting ? aiWriting.level : Math.max(1, Math.min(10, objOverall - 1))

  const result = buildPlacementResult(
    [
      ...objResults,
      {
        domain: 'WRITING' as AdaptiveDomain,
        level: writingLevel,
        rawScore: aiWriting ? aiWriting.score / 100 : 0.5,
        confidence: aiWriting ? ('MEDIUM' as const) : ('LOW' as const),
      },
    ],
    null,
  )

  const now = new Date()
  await prisma.$transaction([
    prisma.placementAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        pending: { kind: 'done' },
        overallLevel: result.overallLevel,
        assessedLevels: {
          grammar: result.grammarLevel,
          vocabulary: result.vocabularyLevel,
          reading: result.readingLevel,
          listening: result.listeningLevel,
          writing: result.writingLevel,
          overall: result.overallLevel,
        },
        placementResult: {
          ...JSON.parse(JSON.stringify(result)),
          writingAiReports: aiWriting ? JSON.parse(JSON.stringify(aiWriting.reports)) : null,
        },
        resultToken: generateToken(),
        resultExpiresAt: new Date(now.getTime() + RESULT_VALID_DAYS * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.placementInvite.update({
      where: { id: invite.id },
      data: { status: 'COMPLETED' },
    }),
    prisma.lead.update({
      where: { id: invite.leadId },
      data: { lastActivityAt: now },
    }),
  ])

  // 출제 문제 사용 이력(학원별 1년 중복 방지) + 품질 통계
  recordAdaptiveUsage(invite.academyId, attempt.id, history)

  // 담당자(없으면 학원장)에게 앱 알림 — 결과를 먼저 확인하도록
  const recipientId = invite.lead.assigneeId ?? invite.academy.ownerId
  if (recipientId) {
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { role: true },
    })
    const base = recipient?.role === 'TEACHER' ? '/teacher/consultations' : '/owner/consultations'
    await prisma.notification
      .create({
        data: {
          userId: recipientId,
          academyId: invite.academyId,
          type: 'SUCCESS',
          title: '문의 학생 레벨테스트 완료',
          message: `${invite.lead.studentName} 학생이 레벨테스트를 완료했습니다. 측정 레벨: Level ${result.overallLevel}`,
          link: `${base}/${invite.leadId}`,
        },
      })
      .catch((err) => console.error('[placement] 완료 알림 생성 실패:', err))
  }
}
