-- CreateTable
CREATE TABLE "keypad_devices" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "rate_window_start" TIMESTAMP(3),
    "rate_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keypad_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keypad_registration_codes" (
    "id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keypad_registration_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "keypad_devices_token_hash_key" ON "keypad_devices"("token_hash");

-- CreateIndex
CREATE INDEX "keypad_devices_academy_id_created_at_idx" ON "keypad_devices"("academy_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "keypad_registration_codes_code_hash_key" ON "keypad_registration_codes"("code_hash");

-- CreateIndex
CREATE INDEX "keypad_registration_codes_academy_id_created_at_idx" ON "keypad_registration_codes"("academy_id", "created_at");

-- AddForeignKey
ALTER TABLE "keypad_devices" ADD CONSTRAINT "keypad_devices_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keypad_registration_codes" ADD CONSTRAINT "keypad_registration_codes_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keypad_registration_codes" ADD CONSTRAINT "keypad_registration_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

