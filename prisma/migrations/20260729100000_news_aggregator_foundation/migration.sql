CREATE TYPE "NewsSourceScope" AS ENUM ('SYSTEM', 'TENANT');
CREATE TYPE "NewsSourceType" AS ENUM ('RSS', 'WEB', 'X', 'INSTAGRAM');
CREATE TYPE "NewsCategory" AS ENUM ('STONE_INDUSTRY', 'STONE_MACHINERY', 'CONSTRUCTION', 'SWISS_CONSTRUCTION', 'ARCHITECTURE', 'INTERIOR_DESIGN', 'MATERIALS', 'BUSINESS_MARKET', 'EVENTS');
CREATE TYPE "NewsSourceStatus" AS ENUM ('WORKING', 'DEGRADED', 'DISABLED', 'REQUIRES_API', 'UNSUPPORTED', 'ERROR');
CREATE TYPE "NewsRunType" AS ENUM ('SCHEDULED', 'MANUAL', 'SOURCE_TEST', 'SEED');
CREATE TYPE "NewsRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'COOLDOWN');
CREATE TYPE "NewsSummaryBasis" AS ENUM ('FULL_TEXT', 'EXCERPT', 'SOCIAL_POST');

CREATE TABLE "news_sources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" "NewsSourceScope" NOT NULL DEFAULT 'SYSTEM',
  "tenant_id" UUID,
  "endpoint_hash" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "source_type" "NewsSourceType" NOT NULL,
  "category" "NewsCategory" NOT NULL,
  "homepage_url" TEXT NOT NULL,
  "feed_url" TEXT,
  "language" VARCHAR(12) NOT NULL,
  "country" VARCHAR(12),
  "priority" INTEGER NOT NULL DEFAULT 3,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "status" "NewsSourceStatus" NOT NULL DEFAULT 'WORKING',
  "status_message" TEXT,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "exclude_words" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "last_attempt_at" TIMESTAMPTZ(3),
  "last_success_at" TIMESTAMPTZ(3),
  "consecutive_errors" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "source_id" UUID NOT NULL,
  "normalized_url_hash" VARCHAR(64) NOT NULL,
  "external_id" VARCHAR(500),
  "original_url" TEXT NOT NULL,
  "canonical_url" TEXT NOT NULL,
  "title_original" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "summary_ru" TEXT NOT NULL,
  "key_facts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "category" "NewsCategory" NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "language" VARCHAR(12) NOT NULL,
  "published_at" TIMESTAMPTZ(3),
  "source_name" VARCHAR(255) NOT NULL,
  "summary_basis" "NewsSummaryBasis" NOT NULL DEFAULT 'EXCERPT',
  "relevance_score" INTEGER NOT NULL DEFAULT 0,
  "quality_score" INTEGER NOT NULL DEFAULT 0,
  "content_sufficient" BOOLEAN NOT NULL DEFAULT false,
  "warning" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "run_type" "NewsRunType" NOT NULL,
  "status" "NewsRunStatus" NOT NULL DEFAULT 'QUEUED',
  "started_at" TIMESTAMPTZ(3),
  "finished_at" TIMESTAMPTZ(3),
  "message" TEXT,
  "items_found" INTEGER NOT NULL DEFAULT 0,
  "items_added" INTEGER NOT NULL DEFAULT 0,
  "sources_checked" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_editions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "edition_date" DATE NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "NewsRunStatus" NOT NULL DEFAULT 'SUCCESS',
  "summary" TEXT,
  "last_run_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_editions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_edition_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "edition_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "rank" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_edition_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "news_sources_endpoint_hash_key" ON "news_sources"("endpoint_hash");
CREATE INDEX "news_sources_tenant_id_enabled_status_idx" ON "news_sources"("tenant_id", "enabled", "status");
CREATE INDEX "news_sources_source_type_enabled_status_idx" ON "news_sources"("source_type", "enabled", "status");

CREATE UNIQUE INDEX "news_items_normalized_url_hash_key" ON "news_items"("normalized_url_hash");
CREATE INDEX "news_items_source_id_external_id_idx" ON "news_items"("source_id", "external_id");
CREATE INDEX "news_items_published_at_idx" ON "news_items"("published_at");

CREATE INDEX "news_runs_tenant_id_status_created_at_idx" ON "news_runs"("tenant_id", "status", "created_at");

CREATE UNIQUE INDEX "news_editions_tenant_id_edition_date_version_key" ON "news_editions"("tenant_id", "edition_date", "version");
CREATE INDEX "news_editions_tenant_id_edition_date_idx" ON "news_editions"("tenant_id", "edition_date");

CREATE UNIQUE INDEX "news_edition_items_edition_id_item_id_key" ON "news_edition_items"("edition_id", "item_id");
CREATE INDEX "news_edition_items_edition_id_rank_idx" ON "news_edition_items"("edition_id", "rank");

ALTER TABLE "news_sources" ADD CONSTRAINT "news_sources_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "news_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_runs" ADD CONSTRAINT "news_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_editions" ADD CONSTRAINT "news_editions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_editions" ADD CONSTRAINT "news_editions_last_run_id_fkey" FOREIGN KEY ("last_run_id") REFERENCES "news_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "news_edition_items" ADD CONSTRAINT "news_edition_items_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "news_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "news_edition_items" ADD CONSTRAINT "news_edition_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "news_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
