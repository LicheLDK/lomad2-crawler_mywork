/**
 * 이미 synchronize 로 스키마가 있는 DB에 baseline migration 을
 * "실행된 것으로" 기록한다. (CREATE 를 다시 돌리지 않음)
 *
 * 사용: npx ts-node -r tsconfig-paths/register src/database/scripts/mark-baseline-migrated.ts
 */
import { config as loadEnv } from 'dotenv';
import { AppDataSource } from '../data-source';

loadEnv();

const BASELINE = 'BaselineSchema1753587600000';
const TIMESTAMP = 1753587600000;

async function main(): Promise<void> {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  try {
    const tables = await qr.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'crawler_site'
    `);
    if (!tables.length) {
      throw new Error(
        'crawler_site 테이블이 없습니다. 빈 DB이면 npm run migration:run 을 사용하세요.',
      );
    }

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "typeorm_migrations" (
        "id" SERIAL PRIMARY KEY,
        "timestamp" bigint NOT NULL,
        "name" character varying NOT NULL
      )
    `);

    const existing = await qr.query(
      `SELECT 1 FROM "typeorm_migrations" WHERE "name" = $1 LIMIT 1`,
      [BASELINE],
    );
    if (existing.length) {
      console.log(`Already marked: ${BASELINE}`);
      return;
    }

    await qr.query(
      `INSERT INTO "typeorm_migrations" ("timestamp", "name") VALUES ($1, $2)`,
      [TIMESTAMP, BASELINE],
    );
    console.log(`Marked baseline migrated: ${BASELINE}`);
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
