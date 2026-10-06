import "server-only";
import { prisma } from "@/lib/prisma/client";
import { calculateNextWordReview, type SrsQuality } from "./srs";
import { resolveMastery, type MasteryOutcome, type StudyActivity, type StudyContext } from "./mastery";
import { endOfTodayKst, todayKst, toKstDateKey } from "@/lib/attendance/time";
import type { WordProgress } from "@/generated/prisma";

/**
 * 오늘 복습할 단어 (오늘 KST 안에 기한이 도래하는 단어까지).
 * 어려운 단어(망각 많음 → 기억 용이도 낮음)를 먼저, 그다음 복습 기한이 오래된 순으로 제공한다.
 */
export async function getDueWords(studentId: string, limit: number) {
  return prisma.wordProgress.findMany({
    where: {
      studentId,
      nextReviewAt: { lte: endOfTodayKst() },
    },
    include: { word: true },
    orderBy: [{ lapses: "desc" }, { easeFactor: "asc" }, { nextReviewAt: "asc" }],
    take: limit,
  });
}

/** 같은 KST 날짜인지 (서버가 UTC라 getDate() 비교는 KST 오전 9시가 경계가 됨) */
function isSameKstDay(a: Date, b: Date): boolean {
  return toKstDateKey(a) === toKstDateKey(b);
}

export interface WordAnswerInput {
  activity: StudyActivity;
  context: StudyContext;
  quality: SrsQuality;
  isCorrect: boolean;
}

export interface WordAnswerResult {
  progress: WordProgress;
  outcome: MasteryOutcome;
  /** 복습(REVIEW) 응답 중 오늘 이 단어를 처음 복습한 경우 */
  firstReviewToday: boolean;
}

const LAPSE_RETRY_MS = 24 * 60 * 60 * 1000;

/**
 * 단어 응답 1건을 SRS·학습 단계·망각/마스터 기록에 반영한다.
 * 하루의 다단계 학습(플래시카드→리콜→스펠)은 SRS를 1회만 진행시키고,
 * 망각(lapse)은 같은 날이라도 즉시 SRS를 초기화해 다음 날 다시 복습하게 한다.
 */
export async function applyWordAnswer(
  existing: WordProgress,
  input: WordAnswerInput,
): Promise<WordAnswerResult> {
  const now = new Date();
  const todayKey = todayKst();
  const studiedToday = !!existing.lastStudiedAt && isSameKstDay(existing.lastStudiedAt, now);

  const srs = studiedToday
    ? {
        easeFactor: existing.easeFactor,
        intervalDays: existing.intervalDays,
        repetitions: existing.repetitions,
        nextReviewAt: existing.nextReviewAt,
      }
    : calculateNextWordReview(
        {
          easeFactor: existing.easeFactor,
          intervalDays: existing.intervalDays,
          repetitions: existing.repetitions,
        },
        input.quality,
      );

  const learnedBeforeToday =
    existing.stage === "MASTERED" ||
    (!!existing.learnedAt && toKstDateKey(existing.learnedAt) !== todayKey);

  const outcome = resolveMastery({
    current: existing.stage,
    activity: input.activity,
    isCorrect: input.isCorrect,
    repetitionsAfter: srs.repetitions,
    learnedBeforeToday,
    hasLearnedAt: !!existing.learnedAt,
  });

  // 망각: 같은 날 이미 학습했더라도 SRS를 초기화하고 다음 날 복습 대상으로 만든다.
  const schedule = outcome.isLapse
    ? {
        easeFactor: Math.max(1.3, existing.easeFactor - 0.2),
        intervalDays: 1,
        repetitions: 0,
        nextReviewAt: new Date(now.getTime() + LAPSE_RETRY_MS),
      }
    : srs;

  const firstReviewToday =
    input.context === "REVIEW" &&
    !(existing.lastReviewedAt && isSameKstDay(existing.lastReviewedAt, now));

  const progress = await prisma.wordProgress.update({
    where: { id: existing.id },
    data: {
      easeFactor: schedule.easeFactor,
      intervalDays: schedule.intervalDays,
      repetitions: schedule.repetitions,
      nextReviewAt: schedule.nextReviewAt,
      stage: outcome.stage,
      correctCount: { increment: input.isCorrect ? 1 : 0 },
      wrongCount: { increment: input.isCorrect ? 0 : 1 },
      lastStudiedAt: now,
      ...(outcome.isLapse ? { lapses: { increment: 1 } } : {}),
      ...(outcome.becameLearned ? { learnedAt: now } : {}),
      ...(outcome.becameMastered ? { masteredAt: now } : {}),
      ...(outcome.lostMastery ? { masteredAt: null } : {}),
      ...(input.context === "REVIEW" ? { lastReviewedAt: now } : {}),
    },
  });

  return { progress, outcome, firstReviewToday };
}

/**
 * 단어시험 오답 단어를 복습 큐에 즉시 넣는다.
 * - 진도가 없으면 새로 만들고(즉시 복습 대상)
 * - 학습 완료/마스터 단어는 망각 처리(RECALL 강등, SRS 초기화)
 * 반환값: 망각 처리된 단어 수
 */
export async function queueWrongWordsForReview(studentId: string, wordIds: string[]): Promise<number> {
  if (wordIds.length === 0) return 0;
  const now = new Date();

  const existing = await prisma.wordProgress.findMany({
    where: { studentId, wordId: { in: wordIds } },
    select: { wordId: true, stage: true, learnedAt: true },
  });
  const existingIds = new Set(existing.map((p) => p.wordId));
  const lapsedIds = existing
    .filter((p) => p.stage === "MASTERED" || p.stage === "SPELL" || p.learnedAt)
    .map((p) => p.wordId);
  const otherIds = existing.map((p) => p.wordId).filter((id) => !lapsedIds.includes(id));
  const newIds = wordIds.filter((id) => !existingIds.has(id));

  await prisma.$transaction([
    ...(newIds.length > 0
      ? [
          prisma.wordProgress.createMany({
            data: newIds.map((wordId) => ({ studentId, wordId, nextReviewAt: now })),
            skipDuplicates: true,
          }),
        ]
      : []),
    ...(lapsedIds.length > 0
      ? [
          prisma.wordProgress.updateMany({
            where: { studentId, wordId: { in: lapsedIds } },
            data: {
              stage: "RECALL",
              repetitions: 0,
              intervalDays: 0,
              nextReviewAt: now,
              masteredAt: null,
              lapses: { increment: 1 },
              wrongCount: { increment: 1 },
            },
          }),
        ]
      : []),
    ...(otherIds.length > 0
      ? [
          prisma.wordProgress.updateMany({
            where: { studentId, wordId: { in: otherIds } },
            data: { nextReviewAt: now, wrongCount: { increment: 1 } },
          }),
        ]
      : []),
  ]);

  return lapsedIds.length;
}

export type { SrsQuality };
