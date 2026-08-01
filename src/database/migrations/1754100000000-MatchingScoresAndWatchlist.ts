import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P0: Matching 점수 영속화 + Investigation 워치리스트 플래그.
 * - search_history_results: matchingScore / aiScore / matchingReason / matchingScores
 * - investigation_cases: watchlisted (70~89 관찰용)
 */
export class MatchingScoresAndWatchlist1754100000000
  implements MigrationInterface
{
  name = 'MatchingScoresAndWatchlist1754100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "search_history_results"
        ADD COLUMN IF NOT EXISTS "matchingScore" double precision,
        ADD COLUMN IF NOT EXISTS "aiScore" double precision,
        ADD COLUMN IF NOT EXISTS "matchingReason" text,
        ADD COLUMN IF NOT EXISTS "matchingScores" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        ADD COLUMN IF NOT EXISTS "watchlisted" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investigation_cases_watchlisted"
        ON "investigation_cases" ("watchlisted")
        WHERE "watchlisted" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_investigation_cases_watchlisted"`,
    );
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        DROP COLUMN IF EXISTS "watchlisted"
    `);
    await queryRunner.query(`
      ALTER TABLE "search_history_results"
        DROP COLUMN IF EXISTS "matchingScores",
        DROP COLUMN IF EXISTS "matchingReason",
        DROP COLUMN IF EXISTS "aiScore",
        DROP COLUMN IF EXISTS "matchingScore"
    `);
  }
}
