import { describe, it, expect } from "vitest";
import { calculateNextWordReview } from "./srs";

const BASE = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

describe("calculateNextWordReview", () => {
  it("신규 첫 정답(quality=4): rep=1, interval=1", () => {
    const r = calculateNextWordReview(BASE, 4);
    expect(r.repetitions).toBe(1);
    expect(r.intervalDays).toBe(1);
    expect(r.easeFactor).toBeCloseTo(2.5, 5); // quality=4: EF 변화 없음 (2.5 + 0 = 2.5)
  });

  it("두 번째 정답(rep=1): interval=6", () => {
    const r = calculateNextWordReview({ ...BASE, repetitions: 1, intervalDays: 1 }, 4);
    expect(r.intervalDays).toBe(6);
    expect(r.repetitions).toBe(2);
  });

  it("세 번째 이상 정답: prevInterval*EF", () => {
    const r = calculateNextWordReview({ easeFactor: 2.5, intervalDays: 6, repetitions: 2 }, 4);
    expect(r.intervalDays).toBe(Math.round(6 * 2.5));
    expect(r.repetitions).toBe(3);
  });

  it("연속 정답 시 interval 증가", () => {
    let p = { ...BASE };
    for (let i = 0; i < 5; i++) p = calculateNextWordReview(p, 4);
    expect(p.intervalDays).toBeGreaterThan(6);
  });

  it("오답(quality=1): repetitions 초기화, interval=1", () => {
    const r = calculateNextWordReview({ easeFactor: 2.5, intervalDays: 15, repetitions: 3 }, 1);
    expect(r.repetitions).toBe(0);
    expect(r.intervalDays).toBe(1);
  });

  it("quality=2(경계): repetitions 초기화", () => {
    const r = calculateNextWordReview({ easeFactor: 2.5, intervalDays: 6, repetitions: 2 }, 2);
    expect(r.repetitions).toBe(0);
  });

  it("quality=3(경계): 정상 진행", () => {
    const r = calculateNextWordReview(BASE, 3);
    expect(r.repetitions).toBe(1);
  });

  it("EF 하한 1.3 준수", () => {
    let p = { easeFactor: 1.3, intervalDays: 1, repetitions: 1 };
    for (let i = 0; i < 5; i++) p = calculateNextWordReview(p, 0);
    expect(p.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("quality=5(최고): EF 증가", () => {
    const r = calculateNextWordReview(BASE, 5);
    expect(r.easeFactor).toBeCloseTo(2.6, 5);
  });

  it("quality=0(최저): EF 감소 후 하한 적용", () => {
    const r = calculateNextWordReview(BASE, 0);
    expect(r.easeFactor).toBeGreaterThanOrEqual(1.3);
    expect(r.repetitions).toBe(0);
    expect(r.intervalDays).toBe(1);
  });

  it("nextReviewAt은 intervalDays 후 날짜", () => {
    const before = Date.now();
    const r = calculateNextWordReview({ easeFactor: 2.5, intervalDays: 6, repetitions: 2 }, 4);
    const expected = before + r.intervalDays * 24 * 60 * 60 * 1000;
    expect(r.nextReviewAt.getTime()).toBeGreaterThanOrEqual(expected - 100);
    expect(r.nextReviewAt.getTime()).toBeLessThanOrEqual(expected + 1000);
  });
});
