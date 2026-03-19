-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'GRADED');

-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "class_id" TEXT,
ADD COLUMN     "status" "TestStatus" NOT NULL DEFAULT 'DRAFT';

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
