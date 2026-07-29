import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Investigation 워크플로 필드 (D-3).
 * notes / finalDecision / finalDecisionNote / decidedAt / dueDate.
 * evidence 컬럼·테이블은 추가하지 않는다 (D3 결정).
 */
export class InvestigationWorkflowFields1753800000000
  implements MigrationInterface
{
  name = 'InvestigationWorkflowFields1753800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        ADD COLUMN IF NOT EXISTS "notes" jsonb NOT NULL DEFAULT '[]'
    `);
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        ADD COLUMN IF NOT EXISTS "finalDecision" character varying(50)
    `);
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        ADD COLUMN IF NOT EXISTS "finalDecisionNote" text
    `);
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP WITH TIME ZONE
    `);
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP WITH TIME ZONE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        DROP COLUMN IF EXISTS "dueDate"
    `);
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        DROP COLUMN IF EXISTS "decidedAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        DROP COLUMN IF EXISTS "finalDecisionNote"
    `);
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        DROP COLUMN IF EXISTS "finalDecision"
    `);
    await queryRunner.query(`
      ALTER TABLE "investigation_cases"
        DROP COLUMN IF EXISTS "notes"
    `);
  }
}
