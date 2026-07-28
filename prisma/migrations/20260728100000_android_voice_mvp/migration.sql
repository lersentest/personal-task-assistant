CREATE TYPE "MobileDevicePlatform" AS ENUM ('ANDROID', 'WEAR_OS');
CREATE TYPE "VoiceCommandSource" AS ENUM ('ANDROID_APP', 'ANDROID_WIDGET', 'ANDROID_SIDE_BUTTON');
CREATE TYPE "MobileVoiceDraftStatus" AS ENUM ('READY_FOR_CONFIRMATION', 'CONFIRMING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED');
CREATE TYPE "MobileVoiceRequestType" AS ENUM ('PREVIEW', 'CONFIRM', 'CANCEL');
CREATE TYPE "MobileVoiceRequestStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "mobile_device_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "platform" "MobileDevicePlatform" NOT NULL DEFAULT 'ANDROID',
  "device_name" VARCHAR(200) NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "last_used_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "mobile_device_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mobile_voice_drafts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "device_session_id" UUID NOT NULL,
  "client_command_id" VARCHAR(120) NOT NULL,
  "source" "VoiceCommandSource" NOT NULL,
  "status" "MobileVoiceDraftStatus" NOT NULL DEFAULT 'READY_FOR_CONFIRMATION',
  "transcript" TEXT NOT NULL,
  "task_payload" JSONB NOT NULL,
  "preview" JSONB NOT NULL,
  "task_id" UUID,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "confirmed_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "mobile_voice_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mobile_voice_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "device_session_id" UUID NOT NULL,
  "draft_id" UUID,
  "idempotency_key_hash" VARCHAR(128) NOT NULL,
  "request_type" "MobileVoiceRequestType" NOT NULL,
  "status" "MobileVoiceRequestStatus" NOT NULL DEFAULT 'PROCESSING',
  "response" JSONB,
  "error_code" VARCHAR(80),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "mobile_voice_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mobile_device_sessions_token_hash_key" ON "mobile_device_sessions"("token_hash");
CREATE INDEX "mobile_device_sessions_owner_id_revoked_at_idx" ON "mobile_device_sessions"("owner_id", "revoked_at");

CREATE UNIQUE INDEX "mobile_voice_drafts_device_session_id_client_command_id_key" ON "mobile_voice_drafts"("device_session_id", "client_command_id");
CREATE INDEX "mobile_voice_drafts_owner_id_status_expires_at_idx" ON "mobile_voice_drafts"("owner_id", "status", "expires_at");
CREATE INDEX "mobile_voice_drafts_task_id_idx" ON "mobile_voice_drafts"("task_id");

CREATE UNIQUE INDEX "mobile_voice_requests_device_session_id_idempotency_key_hash_key" ON "mobile_voice_requests"("device_session_id", "idempotency_key_hash");
CREATE INDEX "mobile_voice_requests_owner_id_request_type_created_at_idx" ON "mobile_voice_requests"("owner_id", "request_type", "created_at");
CREATE INDEX "mobile_voice_requests_draft_id_idx" ON "mobile_voice_requests"("draft_id");

ALTER TABLE "mobile_device_sessions"
  ADD CONSTRAINT "mobile_device_sessions_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mobile_voice_drafts"
  ADD CONSTRAINT "mobile_voice_drafts_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mobile_voice_drafts"
  ADD CONSTRAINT "mobile_voice_drafts_device_session_id_fkey"
  FOREIGN KEY ("device_session_id") REFERENCES "mobile_device_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mobile_voice_drafts"
  ADD CONSTRAINT "mobile_voice_drafts_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mobile_voice_requests"
  ADD CONSTRAINT "mobile_voice_requests_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mobile_voice_requests"
  ADD CONSTRAINT "mobile_voice_requests_device_session_id_fkey"
  FOREIGN KEY ("device_session_id") REFERENCES "mobile_device_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mobile_voice_requests"
  ADD CONSTRAINT "mobile_voice_requests_draft_id_fkey"
  FOREIGN KEY ("draft_id") REFERENCES "mobile_voice_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
