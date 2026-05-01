-- CreateEnum
CREATE TYPE "OverageMode" AS ENUM ('REALTIME', 'WEEKLY', 'MONTHLY', 'BLOCK');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "overage_mode" "OverageMode" NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE "subscriptions" ADD COLUMN "overage_blocked" BOOLEAN NOT NULL DEFAULT false;
