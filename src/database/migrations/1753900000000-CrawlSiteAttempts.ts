import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 사이트별 크롤 시도 기록 테이블 (TASK B-3).
 * 성공/실패·지연·errorCode·adapterVersion 을 저장한다.
 */
export class CrawlSiteAttempts1753900000000 implements MigrationInterface {
  name = 'CrawlSiteAttempts1753900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crawl_site_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "searchHistoryId" uuid NOT NULL,
        "siteCode" character varying(50) NOT NULL,
        "success" boolean NOT NULL,
        "durationMs" integer NOT NULL,
        "resultCount" integer NOT NULL DEFAULT 0,
        "errorCode" character varying(64),
        "responseStatus" integer,
        "adapterVersion" character varying(32) NOT NULL,
        "errorMessage" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_crawl_site_attempts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crawl_site_attempts_siteCode_createdAt"
        ON "crawl_site_attempts" ("siteCode", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_crawl_site_attempts_searchHistoryId"
        ON "crawl_site_attempts" ("searchHistoryId")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_crawl_site_attempts_searchHistoryId'
        ) THEN
          ALTER TABLE "crawl_site_attempts"
            ADD CONSTRAINT "FK_crawl_site_attempts_searchHistoryId"
            FOREIGN KEY ("searchHistoryId")
            REFERENCES "search_history"("id")
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "crawl_site_attempts" DROP CONSTRAINT IF EXISTS "FK_crawl_site_attempts_searchHistoryId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "crawl_site_attempts"`);
  }
}
