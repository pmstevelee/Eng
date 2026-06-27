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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function applySrsResult(
  studentId: string,
  wordId: string,
  quality: SrsQuality
) {
  const existing = await prisma.wordProgress.findUnique({
    where: { studentId_wordId: { studentId, wordId } },
  });

  const isCorrect = quality >= 3;
  const now = new Date();

  // 하루의 다단계 학습(플래시카드→리콜→스펠)은 1회 복습으로 취급한다.
  // 같은 날 이미 학습한 단어면 SRS 일정(간격/반복/다음 복습일)을 다시 진행시키지 않고
  // 정답/오답 카운트만 갱신한다. (간격이 1일→6일→15일로 과도하게 늘어나는 문제 방지)
  if (existing?.lastStudiedAt && isSameDay(existing.lastStudiedAt, now)) {
    return prisma.wordProgress.update({
      where: { studentId_wordId: { studentId, wordId } },
      data: {
        correctCount: { increment: isCorrect ? 1 : 0 },
        wrongCount: { increment: isCorrect ? 0 : 1 },
        lastStudiedAt: now,
      },
    });
  }

  const current = {
    easeFactor: existing?.easeFactor ?? 2.5,
    intervalDays: existing?.intervalDays ?? 0,
    repetitions: existing?.repetitions ?? 0,
  };

  const next = calculateNextWordReview(current, quality);

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
