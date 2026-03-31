import { prisma } from "@/lib/prisma/client";

interface SpacedRepetitionUpdate {
  reviewDueAt: Date | null;
  reviewCount: number;
  consecutiveCorrect: number;
  isMastered: boolean;
}

export function calculateNextReview(current: {
  isCorrect: boolean;
  consecutiveCorrect: number;
  reviewCount: number;
}): SpacedRepetitionUpdate {
  const now = new Date();

  const addDays = (days: number): Date => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  };

  if (!current.isCorrect) {
    return {
      reviewDueAt: addDays(1),
      reviewCount: current.reviewCount + 1,
      consecutiveCorrect: 0,
      isMastered: false,
    };
  }

  if (current.consecutiveCorrect === 0) {
    return {
      reviewDueAt: addDays(3),
      reviewCount: current.reviewCount + 1,
      consecutiveCorrect: 1,
      isMastered: false,
    };
  }

  if (current.consecutiveCorrect === 1) {
    return {
      reviewDueAt: addDays(7),
      reviewCount: current.reviewCount + 1,
      consecutiveCorrect: 2,
      isMastered: false,
    };
  }

  // consecutiveCorrect >= 2
  return {
    reviewDueAt: null,
    reviewCount: current.reviewCount + 1,
    consecutiveCorrect: current.consecutiveCorrect + 1,
    isMastered: true,
  };
}

export async function getReviewDueQuestions(studentId: string) {
  const now = new Date();

  const responses = await prisma.questionResponse.findMany({
    where: {
      isMastered: false,
      reviewDueAt: {
        lte: now,
      },
      session: {
        studentId,
      },
    },
    include: {
      question: true,
    },
    orderBy: {
      reviewDueAt: "asc",
    },
  });

  return responses;
}
