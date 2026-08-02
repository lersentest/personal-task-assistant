-- Custom auth and first-class workspace ownership foundation.

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('PLATFORM_ADMIN', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkspaceMemberRole" AS ENUM ('OWNER', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AuthSessionType" AS ENUM ('WEB', 'MOBILE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_normalized" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "blocked_at" TIMESTAMPTZ(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(3);

UPDATE "users"
SET
  "display_name" = COALESCE("display_name", NULLIF(TRIM(CONCAT("first_name", ' ', COALESCE("last_name", ''))), '')),
  "email" = COALESCE("email", CASE WHEN "telegram_id" = 340465534 THEN 'vadim@instech.com.ua' ELSE NULL END),
  "email_normalized" = COALESCE("email_normalized", CASE WHEN "telegram_id" = 340465534 THEN 'vadim@instech.com.ua' ELSE NULL END),
  "role" = CASE WHEN "telegram_id" = 340465534 THEN 'PLATFORM_ADMIN'::"UserRole" ELSE "role" END,
  "status" = COALESCE("status", 'ACTIVE'::"UserStatus")
WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_normalized_key" ON "users"("email_normalized") WHERE "email_normalized" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "users_role_status_idx" ON "users"("role", "status");

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" VARCHAR(200) NOT NULL,
  "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_at" TIMESTAMPTZ(3)
);

CREATE INDEX IF NOT EXISTS "workspaces_owner_user_id_status_idx" ON "workspaces"("owner_user_id", "status");

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "workspace_id" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'OWNER',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("workspace_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "workspace_members_user_id_role_idx" ON "workspace_members"("user_id", "role");

INSERT INTO "workspaces" ("owner_user_id", "name")
SELECT
  u."id",
  COALESCE(u."display_name", u."email", u."first_name", 'Workspace')
FROM "users" u
WHERE u."deleted_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "workspaces" w WHERE w."owner_user_id" = u."id");

INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
SELECT w."id", w."owner_user_id", 'OWNER'::"WorkspaceMemberRole"
FROM "workspaces" w
ON CONFLICT ("workspace_id", "user_id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "session_type" "AuthSessionType" NOT NULL DEFAULT 'WEB',
  "refresh_token_hash" VARCHAR(128) NOT NULL,
  "user_agent" TEXT,
  "ip_address" VARCHAR(64),
  "auth_version" INTEGER NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMPTZ(3)
);

CREATE INDEX IF NOT EXISTS "auth_sessions_user_id_revoked_at_expires_at_idx" ON "auth_sessions"("user_id", "revoked_at", "expires_at");
CREATE INDEX IF NOT EXISTS "auth_sessions_refresh_token_hash_idx" ON "auth_sessions"("refresh_token_hash");
