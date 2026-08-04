import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "publication_operational_status" varchar;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "publication_verification_status" varchar;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "publication_verified_at" timestamp(3) with time zone;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "publication_trace_id" varchar;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_publication_operational_status" varchar;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_publication_verification_status" varchar;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_publication_verified_at" timestamp(3) with time zone;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_publication_trace_id" varchar;

    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "publication_operational_status" varchar;
    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "publication_verification_status" varchar;
    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "publication_verified_at" timestamp(3) with time zone;
    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "publication_trace_id" varchar;
    ALTER TABLE "_categories_v" ADD COLUMN IF NOT EXISTS "version_publication_operational_status" varchar;
    ALTER TABLE "_categories_v" ADD COLUMN IF NOT EXISTS "version_publication_verification_status" varchar;
    ALTER TABLE "_categories_v" ADD COLUMN IF NOT EXISTS "version_publication_verified_at" timestamp(3) with time zone;
    ALTER TABLE "_categories_v" ADD COLUMN IF NOT EXISTS "version_publication_trace_id" varchar;

    ALTER TABLE "home" ADD COLUMN IF NOT EXISTS "publication_operational_status" varchar;
    ALTER TABLE "home" ADD COLUMN IF NOT EXISTS "publication_verification_status" varchar;
    ALTER TABLE "home" ADD COLUMN IF NOT EXISTS "publication_verified_at" timestamp(3) with time zone;
    ALTER TABLE "home" ADD COLUMN IF NOT EXISTS "publication_trace_id" varchar;
    ALTER TABLE "_home_v" ADD COLUMN IF NOT EXISTS "version_publication_operational_status" varchar;
    ALTER TABLE "_home_v" ADD COLUMN IF NOT EXISTS "version_publication_verification_status" varchar;
    ALTER TABLE "_home_v" ADD COLUMN IF NOT EXISTS "version_publication_verified_at" timestamp(3) with time zone;
    ALTER TABLE "_home_v" ADD COLUMN IF NOT EXISTS "version_publication_trace_id" varchar;

    CREATE INDEX IF NOT EXISTS "products_publication_operational_status_idx"
      ON "products" USING btree ("publication_operational_status");
    CREATE INDEX IF NOT EXISTS "products_publication_trace_id_idx"
      ON "products" USING btree ("publication_trace_id");
    CREATE INDEX IF NOT EXISTS "categories_publication_operational_status_idx"
      ON "categories" USING btree ("publication_operational_status");
    CREATE INDEX IF NOT EXISTS "categories_publication_trace_id_idx"
      ON "categories" USING btree ("publication_trace_id");
    CREATE INDEX IF NOT EXISTS "home_publication_operational_status_idx"
      ON "home" USING btree ("publication_operational_status");
    CREATE INDEX IF NOT EXISTS "home_publication_trace_id_idx"
      ON "home" USING btree ("publication_trace_id");

    CREATE TABLE IF NOT EXISTS "publication_receipts" (
      "id" serial PRIMARY KEY NOT NULL,
      "trace_id" varchar NOT NULL,
      "parent_trace_id" varchar,
      "operation" varchar NOT NULL,
      "source" varchar NOT NULL,
      "entity" varchar NOT NULL,
      "document_id" varchar NOT NULL,
      "actor_id" varchar NOT NULL,
      "expected_revision" varchar,
      "saved_revision" varchar,
      "published_revision" varchar,
      "previous_published_revision" varchar,
      "previous_editorial_revision" varchar,
      "observed_revision" varchar,
      "previous_version_id" varchar,
      "status" varchar NOT NULL,
      "verification_status" varchar,
      "contract_version" varchar,
      "retryable" boolean DEFAULT false NOT NULL,
      "verification_attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "rollback" jsonb,
      "issues" jsonb DEFAULT '[]'::jsonb,
      "started_at" timestamp(3) with time zone NOT NULL,
      "completed_at" timestamp(3) with time zone NOT NULL,
      "duration_ms" numeric NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "publication_receipts_trace_id_idx"
      ON "publication_receipts" USING btree ("trace_id");
    CREATE INDEX IF NOT EXISTS "publication_receipts_parent_trace_id_idx"
      ON "publication_receipts" USING btree ("parent_trace_id");
    CREATE INDEX IF NOT EXISTS "publication_receipts_entity_idx"
      ON "publication_receipts" USING btree ("entity");
    CREATE INDEX IF NOT EXISTS "publication_receipts_document_id_idx"
      ON "publication_receipts" USING btree ("document_id");
    CREATE INDEX IF NOT EXISTS "publication_receipts_status_idx"
      ON "publication_receipts" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "publication_receipts_published_revision_idx"
      ON "publication_receipts" USING btree ("published_revision");

    ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'recheckPublication';
    ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'recheckPublication';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "publication_receipts" CASCADE;

    DROP INDEX IF EXISTS "home_publication_trace_id_idx";
    DROP INDEX IF EXISTS "home_publication_operational_status_idx";
    DROP INDEX IF EXISTS "categories_publication_trace_id_idx";
    DROP INDEX IF EXISTS "categories_publication_operational_status_idx";
    DROP INDEX IF EXISTS "products_publication_trace_id_idx";
    DROP INDEX IF EXISTS "products_publication_operational_status_idx";

    ALTER TABLE "_home_v" DROP COLUMN IF EXISTS "version_publication_trace_id";
    ALTER TABLE "_home_v" DROP COLUMN IF EXISTS "version_publication_verified_at";
    ALTER TABLE "_home_v" DROP COLUMN IF EXISTS "version_publication_verification_status";
    ALTER TABLE "_home_v" DROP COLUMN IF EXISTS "version_publication_operational_status";
    ALTER TABLE "home" DROP COLUMN IF EXISTS "publication_trace_id";
    ALTER TABLE "home" DROP COLUMN IF EXISTS "publication_verified_at";
    ALTER TABLE "home" DROP COLUMN IF EXISTS "publication_verification_status";
    ALTER TABLE "home" DROP COLUMN IF EXISTS "publication_operational_status";

    ALTER TABLE "_categories_v" DROP COLUMN IF EXISTS "version_publication_trace_id";
    ALTER TABLE "_categories_v" DROP COLUMN IF EXISTS "version_publication_verified_at";
    ALTER TABLE "_categories_v" DROP COLUMN IF EXISTS "version_publication_verification_status";
    ALTER TABLE "_categories_v" DROP COLUMN IF EXISTS "version_publication_operational_status";
    ALTER TABLE "categories" DROP COLUMN IF EXISTS "publication_trace_id";
    ALTER TABLE "categories" DROP COLUMN IF EXISTS "publication_verified_at";
    ALTER TABLE "categories" DROP COLUMN IF EXISTS "publication_verification_status";
    ALTER TABLE "categories" DROP COLUMN IF EXISTS "publication_operational_status";

    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_publication_trace_id";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_publication_verified_at";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_publication_verification_status";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_publication_operational_status";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "publication_trace_id";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "publication_verified_at";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "publication_verification_status";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "publication_operational_status";
  `)
  // PostgreSQL enum values are intentionally not removed in down migrations.
}
