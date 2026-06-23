import "server-only";
import { prisma } from "@/lib/prisma/client";
import { calculateNextWordReview, type SrsQuality } from "./srs";

export async function getDueWords(studentId: string, limit: number) {
  const now = new Date();
  return prisma.wordProgress.findMany({
    where: {
      studentId,
      nextReviewAt: { lte: now },
    },
    include: { word: true },
    orderBy: { nextReviewAt: "asc" },
    take: limit,
  });
}

export async function applySrsResult(
  studentId: string,
  wordId: string,
  quality: SrsQuality
) {
  const existing = await prisma.wordProgress.findUnique({
    where: { studentId_wordId: { studentId, wordId } },
  });

  const current = {
    easeFactor: existing?.easeFactor ?? 2.5,
    intervalDays: existing?.intervalDays ?? 0,
    repetitions: existing?.repetitions ?? 0,
  };

  const next = calculateNextWordReview(current, quality);
  const isCorrect = quality >= 3;

  return prisma.wordProgress.upsert({
    where: { studentId_wordId: { studentId, wordId } },
    create: {
      studentId,
      wordId,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      nextReviewAt: next.nextReviewAt,
      correctCount: isCorrect ? 1 : 0,
      wrongCount: isCorrect ? 0 : 1,
      lastStudiedAt: new Date(),
    },
    update: {
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      nextReviewAt: next.nextReviewAt,
      correctCount: { increment: isCorrect ? 1 : 0 },
      wrongCount: { increment: isCorrect ? 0 : 1 },
      lastStudiedAt: new Date(),
    },
  });
}
