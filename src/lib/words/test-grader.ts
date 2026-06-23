import 'server-only'
import { checkSpelling } from './spell-check'
import type { WordTestMode } from '@/generated/prisma'

export interface WordTestQuestion {
  wordId: string
  term: string
  meaning: string // DB에서 null인 경우 '' 로 정규화
  partOfSpeech: string | null
  options?: { id: string; term: string; meaning: string }[] // 객관식
  direction: 'EN_TO_KO' | 'KO_TO_EN'
  isSpell: boolean
}

export interface WordTestAnswerRecord {
  wordId: string
  term: string
  meaning: string
  direction: 'EN_TO_KO' | 'KO_TO_EN'
  isSpell: boolean
  correctAnswer: string
  userAnswer: string
  isCorrect: boolean
  isNearlyCorrect?: boolean
}

export interface GradeResult {
  score: number // 0-100 정수
  totalQuestions: number
  correctCount: number
  isPassed: boolean
  answers: WordTestAnswerRecord[]
}

export function gradeTest(
  questions: WordTestQuestion[],
  userAnswers: Record<string, string>, // wordId → userAnswer
  passingScore: number,
): GradeResult {
  const answers: WordTestAnswerRecord[] = questions.map((q) => {
    const userAnswer = userAnswers[q.wordId] ?? ''
    const correctAnswer = q.direction === 'EN_TO_KO' ? q.meaning : q.term

    let isCorrect = false
    let isNearlyCorrect = false

    if (q.isSpell) {
      const result = checkSpelling(q.term, userAnswer)
      isCorrect = result.correct
      isNearlyCorrect = result.nearlyCorrect
    } else {
      // 객관식: userAnswer는 선택한 wordId 또는 meaning/term 문자열
      isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
    }

    return {
      wordId: q.wordId,
      term: q.term,
      meaning: q.meaning,
      direction: q.direction,
      isSpell: q.isSpell,
      correctAnswer,
      userAnswer,
      isCorrect,
      isNearlyCorrect,
    }
  })

  const correctCount = answers.filter((a) => a.isCorrect).length
  const total = questions.length
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0

  return {
    score,
    totalQuestions: total,
    correctCount,
    isPassed: score >= passingScore,
    answers,
  }
}

export function buildQuestions(
  items: { word: { id: string; term: string; meaning: string | null; partOfSpeech: string | null } }[],
  mode: WordTestMode,
  numQuestions: number,
  allWords: { id: string; term: string; meaning: string | null }[], // 오답 선택지용
): WordTestQuestion[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, numQuestions)

  return shuffled.map((item) => {
    const { word } = item
    const isSpell = mode === 'SPELL'
    const direction: 'EN_TO_KO' | 'KO_TO_EN' =
      mode === 'MIXED'
        ? Math.random() < 0.5 ? 'EN_TO_KO' : 'KO_TO_EN'
        : mode === 'KO_TO_EN' ? 'KO_TO_EN' : 'EN_TO_KO'

    const meaning = word.meaning ?? ''

    let options: WordTestQuestion['options']
    if (!isSpell) {
      const distractors = allWords
        .filter((w) => w.id !== word.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((w) => ({ id: w.id, term: w.term, meaning: w.meaning ?? '' }))
      options = [
        { id: word.id, term: word.term, meaning },
        ...distractors,
      ].sort(() => Math.random() - 0.5)
    }

    return {
      wordId: word.id,
      term: word.term,
      meaning,
      partOfSpeech: word.partOfSpeech,
      options,
      direction,
      isSpell,
    }
  })
}
