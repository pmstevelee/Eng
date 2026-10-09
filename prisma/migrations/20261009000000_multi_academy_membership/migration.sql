-- 한 로그인 계정(Supabase Auth)으로 여러 학원에 가입할 수 있도록
-- users 행을 "학원별 프로필"로 바꾼다. auth_id로 같은 계정의 프로필을 묶는다.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "auth_id" TEXT;
UPDATE "users" SET "auth_id" = "id" WHERE "auth_id" IS NULL;
ALTER TABLE "users" ALTER COLUMN "auth_id" SET NOT NULL;

-- DropIndex: 같은 이메일로 여러 학원 프로필 허용
DROP INDEX "users_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_id_academy_id_key" ON "users"("auth_id", "academy_id");
CREATE INDEX "users_email_idx" ON "users"("email");

-- 배포 전환 중(이전 버전 코드가 auth_id 없이 INSERT)에도 가입이 깨지지 않도록
-- auth_id가 비어 있으면 id(= Supabase Auth UUID)로 채운다.
CREATE OR REPLACE FUNCTION "users_default_auth_id"() RETURNS trigger AS $$
BEGIN
  IF NEW."auth_id" IS NULL THEN
    NEW."auth_id" := NEW."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_default_auth_id"
  BEFORE INSERT ON "users"
  FOR EACH ROW EXECUTE FUNCTION "users_default_auth_id"();
