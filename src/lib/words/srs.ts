export const QUALITY = {
  FLASHCARD_KNOW: 4,
  FLASHCARD_UNKNOWN: 2,
  RECALL_CORRECT: 4,
  RECALL_WRONG: 1,
  SPELL_CORRECT: 5,
  SPELL_WRONG: 2,
  SPELL_HINT: 3,
} as const;

export type SrsQuality = 0 | 1 | 2 | 3 | 4 | 5;

export interface SrsProgress {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SrsResult extends SrsProgress {
  nextReviewAt: Date;
}

export function calculateNextWordReview(
  progress: SrsProgress,
  quality: SrsQuality
): SrsResult {
  const { easeFactor, intervalDays, repetitions } = progress;

  let newRepetitions: number;
  let newInterval: number;

  if (quality < 3) {
    newRepetitions = 0;
    newInterval = 1;
  } else {
    newRepetitions = repetitions + 1;
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(intervalDays * easeFactor);
    }
  }

  const newEF = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  const nextReviewAt = new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000);

  return {
    easeFactor: newEF,
    intervalDays: newInterval,
    repetitions: newRepetitions,
    nextReviewAt,
  };
}
