ALTER TABLE "users"
ADD COLUMN "auth_user_id" UUID;

CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");
