import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE IF EXISTS "customers"
      ADD COLUMN IF NOT EXISTS "consent_withdrawn_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "privacy_request_status" varchar DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "privacy_request_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "privacy_request_completed_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "retention_review_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "processing_restricted" boolean DEFAULT false;

    UPDATE "customers"
      SET "privacy_request_status" = 'none'
      WHERE "privacy_request_status" IS NULL;

    UPDATE "customers"
      SET "processing_restricted" = false
      WHERE "processing_restricted" IS NULL;

    ALTER TABLE IF EXISTS "customers"
      ALTER COLUMN "privacy_request_status" SET DEFAULT 'none',
      ALTER COLUMN "processing_restricted" SET DEFAULT false;

    CREATE INDEX IF NOT EXISTS "customers_privacy_request_status_idx"
      ON "customers" USING btree ("privacy_request_status");

    ALTER TABLE IF EXISTS "_customers_v"
      ADD COLUMN IF NOT EXISTS "version_consent_withdrawn_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "version_privacy_request_status" varchar DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "version_privacy_request_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "version_privacy_request_completed_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "version_retention_review_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "version_processing_restricted" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "customers_privacy_request_status_idx";

    ALTER TABLE IF EXISTS "_customers_v"
      DROP COLUMN IF EXISTS "version_processing_restricted",
      DROP COLUMN IF EXISTS "version_retention_review_at",
      DROP COLUMN IF EXISTS "version_privacy_request_completed_at",
      DROP COLUMN IF EXISTS "version_privacy_request_at",
      DROP COLUMN IF EXISTS "version_privacy_request_status",
      DROP COLUMN IF EXISTS "version_consent_withdrawn_at";

    ALTER TABLE IF EXISTS "customers"
      DROP COLUMN IF EXISTS "processing_restricted",
      DROP COLUMN IF EXISTS "retention_review_at",
      DROP COLUMN IF EXISTS "privacy_request_completed_at",
      DROP COLUMN IF EXISTS "privacy_request_at",
      DROP COLUMN IF EXISTS "privacy_request_status",
      DROP COLUMN IF EXISTS "consent_withdrawn_at";
  `)
}
