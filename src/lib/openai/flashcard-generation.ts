import 'server-only'
import OpenAI from 'openai'
import { AI_MODEL } from './models'

/** AI가 고르는 품사 — 기존 단어 DB 표기(n, v, adj …)와 같은 약어 */
export const FLASHCARD_PARTS_OF_SPEECH = ['n', 'v', 'adj', 'adv', 'prep', 'pron', 'conj', 'det', 'exclam', 'phrase'] as const
export type FlashcardPartOfSpeech = (typeof FLASHCARD_PARTS_OF_SPEECH)[number]

const OXFORD_CEFR = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type FlashcardCefr = (typeof OXFORD_CEFR)[number]

export type FlashcardGenerationInput = {
  term: string
  /** 사용자가 적은 한글 뜻 — 있으면 이 뜻에 맞춰 만든다 */
  meaning: string | null
}

export type GeneratedFlashcard = {
  term: string
  partOfSpeech: FlashcardPartOfSpeech
  meaning: string
  definition: string
  example: string
  oxfordCefr: FlashcardCefr
}

function buildPrompt(batch: FlashcardGenerationInput[], levelHint: FlashcardCefr | null): string {
  const lines = batch
    .map((e, i) => `${i + 1}. "${e.term}"${e.meaning ? ` — Korean meaning given by the teacher: "${e.meaning}"` : ''}`)
    .join('\n')

  return `You are an EFL vocabulary expert making flashcards for Korean students learning English.
${levelHint ? `The students are around CEFR ${levelHint}. Keep definitions and examples at that level.\n` : ''}
Words:
${lines}

Return a JSON object: {"cards": [...]} with exactly ${batch.length} items in the same order. Each item:
- "index": the word's number above
- "term": the word or phrase, spelling corrected if clearly misspelled, otherwise unchanged (keep lowercase unless it is a proper noun)
- "partOfSpeech": one of ${FLASHCARD_PARTS_OF_SPEECH.map((p) => `"${p}"`).join(', ')} ("phrase" for multi-word expressions)
- "meaning": Korean meaning. If the teacher gave one, use it as is (you may only fix obvious typos). Otherwise up to 3 common meanings, comma-separated (e.g. "가다, 이동하다")
- "definition": one simple English definition matching the meaning, max 20 words, without using the word itself
- "example": one natural English example sentence using the word in that meaning, max 20 words
- "cefr": the word's CEFR level, one of "A1", "A2", "B1", "B2", "C1"`
}

type RawCard = Partial<{
  index: number
  term: string
  partOfSpeech: string
  meaning: string
  definition: string
  example: string
  cefr: string
}>

function normalizePos(raw: string | undefined, term: string): FlashcardPartOfSpeech {
  const v = (raw ?? '').toLowerCase().trim()
  const found = FLASHCARD_PARTS_OF_SPEECH.find((p) => p === v)
  if (found) return found
  const aliases: Record<string, FlashcardPartOfSpeech> = {
    noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv', preposition: 'prep', pronoun: 'pron',
    conjunction: 'conj', determiner: 'det', exclamation: 'exclam', interjection: 'exclam', idiom: 'phrase',
  }
  return aliases[v] ?? (term.includes(' ') ? 'phrase' : 'n')
}

function normalizeCefr(raw: string | undefined, fallback: FlashcardCefr): FlashcardCefr {
  const v = (raw ?? '').toUpperCase().trim()
  return OXFORD_CEFR.find((c) => c === v) ?? fallback
}

/** 단어별 생성 결과 — 실패면 사용자에게 보여줄 사유 */
export type FlashcardGenerationResult = { ok: true; card: GeneratedFlashcard } | { ok: false; reason: string }

/** 서버 액션 제한 시간(60초) 안에 끝내기 위한 전체 예산 */
const TOTAL_BUDGET_MS = 50_000
const REQUEST_TIMEOUT_MS = 30_000

const MISSING_REASON = 'AI가 이 단어의 카드를 만들지 못했습니다. 철자를 확인하거나 뜻을 함께 적어 다시 시도해주세요.'

/** OpenAI 오류 → 사용자 안내 문구 */
function failureReason(e: unknown): string {
  if (e instanceof OpenAI.APIConnectionTimeoutError) return 'AI 응답이 너무 오래 걸려 중단됐습니다. 단어 수를 줄여 다시 시도해주세요.'
  if (e instanceof OpenAI.APIError) {
    if (e.status === 401 || e.status === 403) return 'AI 서비스 인증 오류입니다. 관리자에게 문의해주세요.'
    if (e.status === 429) return 'AI 사용량이 많아 잠시 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
    if (e.status && e.status >= 500) return 'AI 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.'
    return 'AI 요청이 거부되었습니다. 관리자에게 문의해주세요.'
  }
  if (e instanceof OpenAI.APIConnectionError) return 'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'
  return 'AI 응답을 처리하지 못했습니다. 다시 시도해주세요.'
}

async function generateBatch(
  openai: OpenAI,
  batch: FlashcardGenerationInput[],
  levelHint: FlashcardCefr | null,
  timeoutMs: number,
): Promise<(GeneratedFlashcard | null)[]> {
  const response = await openai.chat.completions.create(
    {
      model: AI_MODEL,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildPrompt(batch, levelHint) }],
      temperature: 0.3,
      max_tokens: 200 * batch.length + 300,
    },
    { timeout: timeoutMs, maxRetries: 0 },
  )

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('OpenAI 응답이 비어 있습니다.')
  const parsed = JSON.parse(raw) as { cards?: RawCard[] }
  const cards = Array.isArray(parsed.cards) ? parsed.cards : []

  return batch.map((input, i) => {
    const card = cards.find((c) => c.index === i + 1) ?? cards[i]
    const meaning = input.meaning ?? card?.meaning?.trim()
    const definition = card?.definition?.trim()
    const example = card?.example?.trim()
    if (!card || !meaning || !definition || !example) return null
    const term = card.term?.trim() || input.term
    return {
      term,
      partOfSpeech: normalizePos(card.partOfSpeech, term),
      meaning: card.meaning?.trim() || meaning,
      definition,
      example,
      oxfordCefr: normalizeCefr(card.cefr, levelHint ?? 'A2'),
    }
  })
}

/**
 * 단어 목록으로 플래시카드(품사·뜻·영영풀이·예문·레벨)를 만든다. 결과는 입력과 같은 순서.
 * 10개씩 나눠 동시에 요청하고, 빠진 단어는 한 번 더 묶어서, 그래도 빠지면 한 단어씩 다시 요청한다
 * (전체 50초 예산 안에서만). 끝내 만들지 못한 단어는 사유와 함께 돌려주며 과금 대상에서 빠진다.
 */
export async function generateFlashcards(
  entries: FlashcardGenerationInput[],
  levelHint: FlashcardCefr | null,
): Promise<FlashcardGenerationResult[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.')
  const openai = new OpenAI({ apiKey })
  const startedAt = Date.now()
  const remaining = () => TOTAL_BUDGET_MS - (Date.now() - startedAt)

  const results: (FlashcardGenerationResult | null)[] = entries.map(() => null)
  const lastError = new Map<number, unknown>()

  /** indexes(입력 위치)들을 size개씩 묶어 동시에 요청하고 성공한 것만 채운다 */
  async function attempt(indexes: number[], size: number) {
    const groups: number[][] = []
    for (let i = 0; i < indexes.length; i += size) groups.push(indexes.slice(i, i + size))
    const timeoutMs = Math.min(REQUEST_TIMEOUT_MS, remaining())
    if (timeoutMs < 5_000) return
    await Promise.all(
      groups.map(async (group) => {
        try {
          const cards = await generateBatch(openai, group.map((idx) => entries[idx]), levelHint, timeoutMs)
          group.forEach((idx, i) => {
            const card = cards[i]
            if (card) results[idx] = { ok: true, card }
          })
        } catch (e) {
          console.error('[flashcard-generation] 요청 실패', {
            words: group.length,
            status: e instanceof OpenAI.APIError ? e.status : undefined,
            message: e instanceof Error ? e.message : String(e),
          })
          group.forEach((idx) => lastError.set(idx, e))
        }
      }),
    )
  }

  const pending = () => results.flatMap((r, i) => (r ? [] : [i]))

  await attempt(pending(), 10)
  // 빠진 단어 재시도: 한 번 더 묶어서 → 그래도 빠지면 한 단어씩
  if (pending().length > 0 && remaining() > 25_000) await attempt(pending(), 5)
  if (pending().length > 0 && pending().length <= 20 && remaining() > 15_000) await attempt(pending(), 1)

  return results.map(
    (r, i) => r ?? { ok: false, reason: lastError.has(i) ? failureReason(lastError.get(i)) : MISSING_REASON },
  )
}
