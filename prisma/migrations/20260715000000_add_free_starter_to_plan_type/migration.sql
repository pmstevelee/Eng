-- Add FREE and STARTER values to PlanType so Academy.subscription_plan can
-- store the newer Plan tiers used by the card-payment (TossPayments) billing flow.
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'FREE';
ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'STARTER';
