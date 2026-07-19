CREATE TABLE "audit_access_grants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "label" VARCHAR(200),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "grant_id" UUID NOT NULL,
  "owner_id" UUID NOT NULL,
  "session_hash" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "last_seen_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audit_access_grants_token_hash_key"
ON "audit_access_grants"("token_hash");

CREATE UNIQUE INDEX "audit_sessions_session_hash_key"
ON "audit_sessions"("session_hash");

CREATE INDEX "audit_access_grants_owner_id_revoked_at_expires_at_idx"
ON "audit_access_grants"("owner_id", "revoked_at", "expires_at");

CREATE INDEX "audit_sessions_owner_id_revoked_at_expires_at_idx"
ON "audit_sessions"("owner_id", "revoked_at", "expires_at");

CREATE INDEX "audit_sessions_grant_id_revoked_at_idx"
ON "audit_sessions"("grant_id", "revoked_at");

ALTER TABLE "audit_access_grants"
ADD CONSTRAINT "audit_access_grants_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_sessions"
ADD CONSTRAINT "audit_sessions_grant_id_fkey"
FOREIGN KEY ("grant_id") REFERENCES "audit_access_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_sessions"
ADD CONSTRAINT "audit_sessions_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
