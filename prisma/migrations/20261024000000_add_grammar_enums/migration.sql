-- 문법학습관리 enum (테이블 마이그레이션과 분리)

-- CreateEnum
CREATE TYPE "GrammarPointStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "GrammarMasteryState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'MASTERED', 'WEAK');

-- CreateEnum
CREATE TYPE "GrammarAttemptKind" AS ENUM ('PRACTICE', 'CHECK', 'REVIEW', 'CHAPTER');
