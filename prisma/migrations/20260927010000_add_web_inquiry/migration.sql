-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('WEB_INQUIRY', 'WEB_REINQUIRY');

-- AlterTable
ALTER TABLE "academies" ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "web_inquiry_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "academies_slug_key" ON "academies"("slug");

-- CreateIndex
CREATE INDEX "leads_academy_id_web_inquiry_at_idx" ON "leads"("academy_id", "web_inquiry_at");

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

