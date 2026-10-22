import { z } from 'zod'

// 단어 세트 학습 단계(플래시카드/리콜/스펠)별 진행 상태.
// 학습 도중 화면을 떠났다가 다시 들어오면 저장된 위치부터 이어서 진행한다.
// (서버·클라이언트 공용 — DB 접근 코드는 두지 않는다)

export type StudyStage = 'FLASHCARD' | 'RECALL' | 'SPELL'
export type RecallMode = 'EN_TO_KO' | 'KO_TO_EN' | 'MIXED'

/** 한 라운드에 담을 수 있는 최대 단어 수 (세트 최대 크기보다 넉넉하게) */
const MAX_DECK = 1000

export const StudySessionStateSchema = z.object({
  v: z.literal(1),
  /** 현재 라운드 단어 순서 (wordId) */
  deck: z.array(z.string().uuid()).max(MAX_DECK),
  /** 이번 라운드에서 이미 답한 문제 수 = 다음에 풀 위치 */
  index: z.number().int().min(0),
  /** 이번 라운드에서 틀린(모른다) 단어 */
  wrong: z.array(z.string().uuid()).max(MAX_DECK),
  correct: z.number().int().min(0),
  answered: z.number().int().min(0),
  /** 틀린 단어 재출제 횟수 (0 = 첫 라운드) */
  retry: z.number().int().min(0),
  /** 리콜 문제 방향 */
  mode: z.enum(['EN_TO_KO', 'KO_TO_EN', 'MIXED']).optional(),
  /** 저장 시각(ms) — 서버 기록과 브라우저 백업 중 최신 것을 고를 때 사용 */
  savedAt: z.number().int().min(0).optional(),
})

export type StudySessionState = z.infer<typeof StudySessionStateSchema>

export interface ResumedSession<T> {
  deck: T[]
  index: number
  wrong: T[]
  correct: number
  answered: number
  retry: number
  mode?: RecallMode
}

/** 저장된 진행 상태를 DB 값에서 안전하게 읽는다 (형식이 다르면 null). */
export function parseStudySessionState(value: unknown): StudySessionState | null {
  const parsed = StudySessionStateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * 저장된 진행 상태를 오늘의 학습 배치(cards)에 맞춰 복원한다.
 * - 배치에서 빠진 단어는 제외하고, 이미 답한 위치(index)를 그만큼 보정한다.
 * - 첫 라운드라면 저장 이후 배치에 새로 들어온 단어를 뒤에 덧붙인다.
 * - 이어서 진행할 것이 없으면 null (처음부터 시작).
 */
export function resolveStudySession<T extends { word: { id: string } }>(
  state: StudySessionState | null,
  cards: T[],
): ResumedSession<T> | null {
  if (!state || state.index === 0) return null

  const byId = new Map(cards.map((c) => [c.word.id, c]))
  const answeredIds = state.deck.slice(0, state.index).filter((id) => byId.has(id))
  if (answeredIds.length === 0) return null

  const remainingIds = state.deck.slice(state.index).filter((id) => byId.has(id))
  if (state.retry === 0) {
    const inDeck = new Set(state.deck)
    for (const c of cards) if (!inDeck.has(c.word.id)) remainingIds.push(c.word.id)
  }

  const deckIds = [...answeredIds, ...remainingIds]
  const answeredSet = new Set(answeredIds)
  const wrongIds = state.wrong.filter((id) => answeredSet.has(id))
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((c): c is T => c !== undefined)

  return {
    deck: pick(deckIds),
    index: answeredIds.length,
    wrong: pick(wrongIds),
    // 제외된 단어만큼 통계가 맞지 않을 수 있으므로 답한 수를 넘지 않게 보정
    correct: Math.min(state.correct, answeredIds.length),
    answered: Math.min(state.answered, answeredIds.length),
    retry: state.retry,
    mode: state.mode,
  }
}

/** 클라이언트 라운드 상태 → 저장 형식 */
export function toStudySessionState(input: {
  deck: { word: { id: string } }[]
  index: number
  wrong: { word: { id: string } }[]
  correct: number
  answered: number
  retry: number
  mode?: RecallMode
}): StudySessionState {
  return {
    v: 1,
    deck: input.deck.map((c) => c.word.id),
    index: input.index,
    wrong: input.wrong.map((c) => c.word.id),
    correct: input.correct,
    answered: input.answered,
    retry: input.retry,
    ...(input.mode ? { mode: input.mode } : {}),
    savedAt: Date.now(),
  }
}

/** 서버 기록과 브라우저 백업 중 더 최근에 저장된 진행 */
export function pickLatestStudySession(
  server: StudySessionState | null,
  local: StudySessionState | null,
): StudySessionState | null {
  if (!local) return server
  if (!server) return local
  return (local.savedAt ?? 0) > (server.savedAt ?? 0) ? local : server
}
