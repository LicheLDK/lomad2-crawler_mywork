import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 검색 이력별 매물 스냅샷 테이블.
 * crawler_result.url 유니크로 인한 과거 검색 결과 유실을 방지한다.
 */
export class SearchHistoryResults1753601200000 implements MigrationInterface {
  name = 'SearchHistoryResults1753601200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "search_history_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "searchHistoryId" uuid NOT NULL,
        "resultId" uuid NOT NULL,
        "title" character varying(500) NOT NULL,
        "price" bigint,
        "seller" character varying(200),
        "region" character varying(100),
        "imageUrl" text,
        "titleSimilarity" double precision NOT NULL DEFAULT 0,
        "imageSimilarity" double precision NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_search_history_results" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_search_history_results_history_result"
          UNIQUE ("searchHistoryId", "resultId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_search_history_results_searchHistoryId"
        ON "search_history_results" ("searchHistoryId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_search_history_results_resultId"
        ON "search_history_results" ("resultId")
    `);

    // 기존 crawler_result.searchHistoryId 소유 관계를 스냅샷으로 백필
    await queryRunner.query(`
      INSERT INTO "search_history_results" (
        "id",
        "searchHistoryId",
        "resultId",
        "title",
        "price",
        "seller",
        "region",
        "imageUrl",
        "titleSimilarity",
        "imageSimilarity",
        "createdAt"
      )
      SELECT
        uuid_generate_v4(),
        COALESCE(cr."searchHistoryId", cr."search_history_id"),
        cr."id",
        cr."title",
        cr."price",
        cr."seller",
        cr."region",
        cr."imageUrl",
        COALESCE(cr."titleSimilarity", 0),
        COALESCE(cr."imageSimilarity", 0),
        COALESCE(cr."createdAt", now())
      FROM "crawler_result" cr
      WHERE COALESCE(cr."searchHistoryId", cr."search_history_id") IS NOT NULL
      ON CONFLICT ("searchHistoryId", "resultId") DO NOTHING
    `);

    // FK (테이블이 이미 있을 수 있으므로 조건부)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_search_history_results_searchHistoryId'
        ) THEN
          ALTER TABLE "search_history_results"
            ADD CONSTRAINT "FK_search_history_results_searchHistoryId"
            FOREIGN KEY ("searchHistoryId")
            REFERENCES "search_history"("id")
            ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'FK_search_history_results_resultId'
        ) THEN
          ALTER TABLE "search_history_results"
            ADD CONSTRAINT "FK_search_history_results_resultId"
            FOREIGN KEY ("resultId")
            REFERENCES "crawler_result"("id")
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "search_history_results" DROP CONSTRAINT IF EXISTS "FK_search_history_results_searchHistoryId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "search_history_results" DROP CONSTRAINT IF EXISTS "FK_search_history_results_resultId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "search_history_results"`);
  }
}
