import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "product_imports"
      ADD COLUMN IF NOT EXISTS "resumable" boolean,
      ADD COLUMN IF NOT EXISTS "media_cache" jsonb,
      ADD COLUMN IF NOT EXISTS "lease_token" varchar,
      ADD COLUMN IF NOT EXISTS "lease_until" timestamp(3) with time zone;

    CREATE UNIQUE INDEX IF NOT EXISTS "product_imports_active_resumable_owner_idx"
      ON "product_imports" ("requested_by_id")
      WHERE "resumable" AND "status" IN ('queued', 'processing');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "product_imports_active_resumable_owner_idx";
    ALTER TABLE "product_imports"
      DROP COLUMN "resumable",
      DROP COLUMN "media_cache",
      DROP COLUMN "lease_token",
      DROP COLUMN "lease_until";
  `)
}
