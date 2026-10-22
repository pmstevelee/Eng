import type { AiFlashcardCard } from '@/types/ai-flashcard'

const OXFORD_CEFR = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

/** 위고업 단계(1~10) → Oxford CEFR */
export function levelToOxfordCefr(level: number): AiFlashcardCard['oxfordCefr'] {
  const idx = Math.min(5, Math.max(1, Math.ceil(level / 2)))
  return OXFORD_CEFR[idx - 1]
}

/** AI가 만들지 못한 단어 등을 사용자가 직접 채워 넣을 빈 카드 */
export function createManualCard(term: string, meaning: string | null, level: number): AiFlashcardCard {
  const trimmed = term.trim()
  return {
    wordId: null,
    term: trimmed,
    partOfSpeech: trimmed.includes(' ') ? 'phrase' : 'n',
    meaning: meaning?.trim() ?? '',
    definition: '',
    example: '',
    oxfordCefr: levelToOxfordCefr(level),
    origin: 'MANUAL',
  }
}

/** 저장 전 필수 입력(단어·뜻)이 빠진 카드 수 */
export function countIncompleteCards(cards: Pick<AiFlashcardCard, 'term' | 'meaning'>[]): number {
  return cards.filter((c) => !c.term.trim() || !c.meaning.trim()).length
}
