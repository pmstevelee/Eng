-- Phase 7: 웹훅 이벤트 멱등성 + 결제 감사 로그

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'SKIPPED');
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'ADMIN', 'WEBHOOK');

-- CreateTable: webhook_events (멱등성 보장)
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "error_msg" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events"("event_id");
CREATE INDEX "webhook_events_event_type_idx" ON "webhook_events"("event_type");
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");
CREATE INDEX "webhook_events_received_at_idx" ON "webhook_events"("received_at");

-- CreateTable: payment_audit_logs (감사 로그)
CREATE TABLE "payment_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_audit_logs_actor_type_actor_id_idx" ON "payment_audit_logs"("actor_type", "actor_id");
CREATE INDEX "payment_audit_logs_action_idx" ON "payment_audit_logs"("action");
CREATE INDEX "payment_audit_logs_created_at_idx" ON "payment_audit_logs"("created_at");
