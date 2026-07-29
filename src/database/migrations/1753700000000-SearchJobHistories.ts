import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Search Job : SearchHistory 1:N 연결 테이블.
 * 기존 search_jobs.searchHistoryId 를 대표 히스토리로 유지하면서
 * 키워드별 히스토리를 search_job_histories 로 이관(backfill)한다.
 * SearchJobStatus.PARTIAL 을 DB enum 에 추가한다.
 */
export class SearchJobHistories1753700000000 implements MigrationInterface {
  name = 'SearchJobHistories1753700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A4: SearchJobStatus.PARTIAL — DB enum (varchar 아님)
    await queryRunner.query(`
      ALTER TYPE "public"."search_job_status_enum"
        ADD VALUE IF NOT EXISTS 'partial'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "search_job_histories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "searchJobId" uuid NOT NULL,
        "keyword" character varying(255),
        "searchHistoryId" uuid NOT NULL,
        "status" character varying(50) NOT NULL,
        "resultCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_search_job_histories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_search_job_histories_job_history"
          UNIQUE ("searchJobId", "searchHistoryId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_search_job_histories_searchJobId"
        ON "search_job_histories" ("searchJobId")
    `);

    // A5: 기존 search_jobs.searchHistoryId NOT NULL 행을 1행씩 backfill
    await queryRunner.query(`
      INSERT INTO "search_job_histories" (
        "id",
        "searchJobId",
        "keyword",
        "searchHistoryId",
        "status",
        "resultCount",
        "createdAt",
        "updatedAt"
      )
      SELECT
        uuid_generate_v4(),
        sj."id",
        CASE
          WHEN jsonb_typeof(sj."keywords") = 'array'
            AND jsonb_array_length(sj."keywords") > 0
          THEN sj."keywords"->>0
          ELSE NULL
        END,
        sj."searchHistoryId",
        sj."status"::text,
        COALESCE(sj."resultCount", 0),
        COALESCE(sj."requested_at", now()),
        COALESCE(sj."updatedAt", now())
      FROM "search_jobs" sj
      WHERE sj."searchHistoryId" IS NOT NULL
      ON CONFLICT ("searchJobId", "searchHistoryId") DO NOTHING
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_search_job_histories_searchJobId'
        ) THEN
          ALTER TABLE "search_job_histories"
            ADD CONSTRAINT "FK_search_job_histories_searchJobId"
            FOREIGN KEY ("searchJobId")
            REFERENCES "search_jobs"("id")
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "search_job_histories" DROP CONSTRAINT IF EXISTS "FK_search_job_histories_searchJobId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "search_job_histories"`);
    // enum 값 'partial' 은 PostgreSQL 에서 안전하게 제거하기 어려워 유지한다.
    // ADD VALUE IF NOT EXISTS 로 up 재실행이 멱등하다.
  }
}
