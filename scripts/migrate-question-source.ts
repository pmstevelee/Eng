/**
 * 기존 questions 데이터에 source/isVerified 값 채우기
 *
 * - academy_id IS NULL  → source = SYSTEM,          is_verified = true
 * - academy_id NOT NULL → source = TEACHER_CREATED, is_verified = true
 * - usage_count = 0 (기존 이력 미추적)
 *
 * 실행: npx tsx scripts/migrate-question-source.ts
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("문제 source 마이그레이션 시작...\n");

  // 1. 공용 문제 (academy_id = null) → SYSTEM + verified
  const systemResult = await prisma.question.updateMany({
    where: { academyId: null },
    data: {
      source: "SYSTEM",
      isVerified: true,
    },
  });
  console.log(`SYSTEM 처리: ${systemResult.count}개`);

  // 2. 학원 전용 문제 (academy_id = 특정 ID) → TEACHER_CREATED + verified
  const teacherResult = await prisma.question.updateMany({
    where: { academyId: { not: null } },
    data: {
      source: "TEACHER_CREATED",
      isVerified: true,
    },
  });
  console.log(`TEACHER_CREATED 처리: ${teacherResult.count}개`);

  const total = systemResult.count + teacherResult.count;
  console.log(`\n완료: 총 ${total}개 문제 업데이트`);

  // 결과 확인
  const stats = await prisma.question.groupBy({
    by: ["source", "isVerified"],
    _count: { id: true },
  });
  console.log("\n--- 최종 통계 ---");
  for (const row of stats) {
    console.log(
      `  source=${row.source}, isVerified=${row.isVerified}: ${row._count.id}개`
    );
  }
}

main()
  .catch((e) => {
    console.error("마이그레이션 실패:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
