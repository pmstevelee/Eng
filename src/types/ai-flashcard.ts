// AI 플래시카드 (교사·학원장 업로드 → AI 생성) 공용 타입

export type AiFlashcardCard = {
  /** 공용 사전 단어를 그대로 쓰면 그 id, AI가 만들었거나 고친 카드는 null */
  wordId: string | null
  term: string
  partOfSpeech: string
  meaning: string
  definition: string
  example: string
  oxfordCefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
  /** DICTIONARY = 공용 사전에서 가져옴(무료), AI = AI가 만듦 */
  origin: 'DICTIONARY' | 'AI'
}

export type AiFlashcardQuotaView = {
  usedThisMonth: number
  /** 월 무료 한도 (-1: 무제한) */
  freeLimit: number
  /** 남은 무료 단어 수 (null: 무제한) */
  remainingFree: number | null
  creditBalance: number
  creditPerWord: number
  /** 지금 AI로 만들 수 있는 최대 단어 수 (null: 무제한) */
  maxWords: number | null
  blocked: boolean
}
