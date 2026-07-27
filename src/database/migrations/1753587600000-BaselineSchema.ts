import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema — 현재 엔티티 전체.
 * 빈 PostgreSQL volume에서 운영 기동 시 이 migration으로 테이블을 생성한다.
 *
 * 이미 synchronize 로 스키마가 있는 개발 DB:
 *   npm run migration:baseline:mark
 */
export class BaselineSchema1753587600000 implements MigrationInterface {
  name = 'BaselineSchema1753587600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."search_history_status_enum" AS ENUM (
          'pending', 'queued', 'running', 'completed', 'partial', 'failed', 'cached'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."search_job_status_enum" AS ENUM (
          'pending', 'queued', 'running', 'completed', 'failed'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crawler_site" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "name" character varying(100) NOT NULL,
        "baseUrl" character varying(255) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "priority" integer NOT NULL DEFAULT 5,
        "config" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_crawler_site" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_crawler_site_code" ON "crawler_site" ("code")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "search_keyword" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "keyword" character varying(255) NOT NULL,
        "searchCount" integer NOT NULL DEFAULT 1,
        "lastSearchedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_search_keyword" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_search_keyword_keyword" ON "search_keyword" ("keyword")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "search_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "keyword" character varying(255) NOT NULL,
        "keywordId" uuid,
        "externalProductId" character varying(100),
        "sites" text,
        "status" "public"."search_history_status_enum" NOT NULL DEFAULT 'pending',
        "resultCount" integer NOT NULL DEFAULT 0,
        "requestMeta" jsonb,
        "errorMessage" text,
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "finishedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "keyword_id" uuid,
        CONSTRAINT "PK_search_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_search_history_keyword" ON "search_history" ("keyword")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_search_history_externalProductId" ON "search_history" ("externalProductId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crawler_result" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "searchHistoryId" uuid,
        "siteId" uuid,
        "siteCode" character varying(50) NOT NULL,
        "title" character varying(500) NOT NULL,
        "price" bigint,
        "seller" character varying(200),
        "region" character varying(100),
        "url" text NOT NULL,
        "imageUrl" text,
        "description" text,
        "contentHash" character varying(64),
        "titleSimilarity" double precision,
        "imageSimilarity" double precision,
        "listedAt" TIMESTAMP WITH TIME ZONE,
        "raw" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "search_history_id" uuid,
        "site_id" uuid,
        CONSTRAINT "PK_crawler_result" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_crawler_result_url" ON "crawler_result" ("url")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_crawler_result_siteCode" ON "crawler_result" ("siteCode")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "image_hash" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "resultId" uuid NOT NULL,
        "phash" character varying(64),
        "dhash" character varying(64),
        "localPath" text,
        "sourceUrl" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "result_id" uuid,
        CONSTRAINT "PK_image_hash" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_image_hash_phash" ON "image_hash" ("phash")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "search_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderNo" character varying(100) NOT NULL,
        "contractNo" character varying(100),
        "customerName" character varying(100),
        "status" "public"."search_job_status_enum" NOT NULL DEFAULT 'pending',
        "requested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "productNo" character varying(100),
        "productName" character varying(255),
        "brand" character varying(100),
        "modelName" character varying(100),
        "option" character varying(100),
        "color" character varying(100),
        "keywords" jsonb NOT NULL DEFAULT '[]',
        "referenceImageUrl" character varying(1000),
        "sites" text,
        "useCache" boolean NOT NULL DEFAULT true,
        "searchHistoryId" uuid,
        "progress" integer NOT NULL DEFAULT 0,
        "currentSite" character varying(50),
        "resultCount" integer NOT NULL DEFAULT 0,
        "errorMessage" text,
        "finishedAt" TIMESTAMP WITH TIME ZONE,
        "callbackSentAt" TIMESTAMP WITH TIME ZONE,
        "callbackError" text,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_search_jobs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_search_jobs_orderNo" ON "search_jobs" ("orderNo")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_search_jobs_searchHistoryId" ON "search_jobs" ("searchHistoryId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investigation_cases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "caseNo" character varying(40) NOT NULL,
        "productName" character varying(500) NOT NULL,
        "aiScore" double precision NOT NULL DEFAULT 0,
        "status" character varying(30) NOT NULL DEFAULT 'Open',
        "priority" character varying(20) NOT NULL DEFAULT 'Medium',
        "assignee" character varying(100),
        "siteCode" character varying(50) NOT NULL,
        "url" text,
        "imageUrl" text,
        "price" character varying(50),
        "result_id" uuid,
        "searchHistoryId" uuid,
        "searchJobId" uuid,
        "orderNo" character varying(100),
        "contractNo" character varying(100),
        "customerName" character varying(100),
        "orderProductName" character varying(500),
        "listingTitle" character varying(500),
        "autoCreated" boolean NOT NULL DEFAULT false,
        "timeline" jsonb NOT NULL DEFAULT '[]',
        "aiAnalysis" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_investigation_cases" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_investigation_cases_caseNo" ON "investigation_cases" ("caseNo")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_investigation_cases_result_id" ON "investigation_cases" ("result_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_investigation_cases_siteCode" ON "investigation_cases" ("siteCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_investigation_cases_searchHistoryId" ON "investigation_cases" ("searchHistoryId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_investigation_cases_searchJobId" ON "investigation_cases" ("searchJobId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_investigation_cases_orderNo" ON "investigation_cases" ("orderNo")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_investigation_cases_contractNo" ON "investigation_cases" ("contractNo")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" character varying(32) NOT NULL,
        "model" character varying(128) NOT NULL,
        "task" character varying(32) NOT NULL,
        "prompt_tokens" integer NOT NULL DEFAULT 0,
        "completion_tokens" integer NOT NULL DEFAULT 0,
        "total_tokens" integer NOT NULL DEFAULT 0,
        "prompt_preview" text,
        "response_preview" text,
        "response_time_ms" integer NOT NULL DEFAULT 0,
        "cost_usd" numeric(12,6) NOT NULL DEFAULT 0,
        "retry_count" integer NOT NULL DEFAULT 0,
        "success" boolean NOT NULL DEFAULT true,
        "error_message" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_usage_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_usage_logs_provider" ON "ai_usage_logs" ("provider")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_usage_logs_model" ON "ai_usage_logs" ("model")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_usage_logs_task" ON "ai_usage_logs" ("task")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_usage_logs_created_at" ON "ai_usage_logs" ("created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(64) NOT NULL,
        "name" character varying(128) NOT NULL,
        "description" text,
        "enabled" boolean NOT NULL DEFAULT true,
        "priority" integer NOT NULL DEFAULT 100,
        "field" character varying(64) NOT NULL,
        "operator" character varying(16) NOT NULL,
        "value" double precision NOT NULL,
        "action" character varying(64) NOT NULL,
        "message" character varying(512),
        "source" character varying(32) NOT NULL DEFAULT 'config',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_rules" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_rules_code" ON "ai_rules" ("code")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_prompt_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying(64) NOT NULL,
        "version" integer NOT NULL,
        "name" character varying(128) NOT NULL,
        "description" text,
        "system_template" text NOT NULL,
        "user_template" text NOT NULL,
        "active" boolean NOT NULL DEFAULT false,
        "source" character varying(32) NOT NULL DEFAULT 'file',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_prompt_versions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_prompt_versions_key" ON "ai_prompt_versions" ("key")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_prompt_versions_key_version" ON "ai_prompt_versions" ("key", "version")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_prompt_histories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying(64) NOT NULL,
        "version" integer NOT NULL,
        "system_template" text NOT NULL,
        "user_template" text NOT NULL,
        "note" character varying(512),
        "changed_by" character varying(128),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_prompt_histories" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_prompt_histories_key" ON "ai_prompt_histories" ("key")`,
    );

    // FKs — 이미 있으면 스킵
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "search_history"
          ADD CONSTRAINT "FK_search_history_keyword"
          FOREIGN KEY ("keyword_id") REFERENCES "search_keyword"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "crawler_result"
          ADD CONSTRAINT "FK_crawler_result_search_history"
          FOREIGN KEY ("search_history_id") REFERENCES "search_history"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "crawler_result"
          ADD CONSTRAINT "FK_crawler_result_site"
          FOREIGN KEY ("site_id") REFERENCES "crawler_site"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "image_hash"
          ADD CONSTRAINT "UQ_image_hash_result_id" UNIQUE ("result_id");
      EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "image_hash"
          ADD CONSTRAINT "FK_image_hash_result"
          FOREIGN KEY ("result_id") REFERENCES "crawler_result"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "image_hash" DROP CONSTRAINT IF EXISTS "FK_image_hash_result"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "crawler_result" DROP CONSTRAINT IF EXISTS "FK_crawler_result_site"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "crawler_result" DROP CONSTRAINT IF EXISTS "FK_crawler_result_search_history"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "search_history" DROP CONSTRAINT IF EXISTS "FK_search_history_keyword"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "ai_prompt_histories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_prompt_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_usage_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "investigation_cases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "search_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "image_hash"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crawler_result"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "search_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "search_keyword"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crawler_site"`);

    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."search_job_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."search_history_status_enum"`,
    );
  }
}
