-- CreateEnum
CREATE TYPE "PlacementInviteStatus" AS ENUM ('SENT', 'STARTED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PlacementAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "placement_invites" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "PlacementInviteStatus" NOT NULL DEFAULT 'SENT',
    "attempt_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_attempts" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "status" "PlacementAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "history" JSONB NOT NULL DEFAULT '[]',
    "pending" JSONB,
    "writing_answers" JSONB NOT NULL DEFAULT '[]',
    "overall_level" INTEGER,
    "assessed_levels" JSONB,
    "placement_result" JSONB,
    "result_token" TEXT,
    "result_expires_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "placement_invites_token_key" ON "placement_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "placement_invites_attempt_id_key" ON "placement_invites"("attempt_id");

-- CreateIndex
CREATE INDEX "placement_invites_lead_id_created_at_idx" ON "placement_invites"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "placement_invites_status_expires_at_idx" ON "placement_invites"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "placement_attempts_result_token_key" ON "placement_attempts"("result_token");

-- CreateIndex
CREATE INDEX "placement_attempts_lead_id_completed_at_idx" ON "placement_attempts"("lead_id", "completed_at");

-- AddForeignKey
ALTER TABLE "placement_invites" ADD CONSTRAINT "placement_invites_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_invites" ADD CONSTRAINT "placement_invites_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_invites" ADD CONSTRAINT "placement_invites_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "placement_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_invites" ADD CONSTRAINT "placement_invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_attempts" ADD CONSTRAINT "placement_attempts_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_attempts" ADD CONSTRAINT "placement_attempts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

