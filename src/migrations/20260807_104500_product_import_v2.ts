import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_product_imports_status" AS ENUM(
        'queued',
        'processing',
        'completed',
        'completed_with_errors',
        'failed',
        'cancelled'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'productImport';
    ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'productImport';

    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "source_sha256" varchar;
    CREATE INDEX IF NOT EXISTS "media_source_sha256_idx" ON "media" USING btree ("source_sha256");

    CREATE TABLE IF NOT EXISTS "product_imports" (
      "id" serial PRIMARY KEY NOT NULL,
      "status" "enum_product_imports_status" NOT NULL,
      "idempotency_key" varchar NOT NULL,
      "requested_by_id" integer NOT NULL,
      "requested_by_name" varchar,
      "requested_by_email" varchar,
      "requested_at" timestamp(3) with time zone NOT NULL,
      "started_at" timestamp(3) with time zone,
      "completed_at" timestamp(3) with time zone,
      "total_rows" numeric NOT NULL,
      "processed_rows" numeric DEFAULT 0 NOT NULL,
      "created" numeric DEFAULT 0 NOT NULL,
      "updated" numeric DEFAULT 0 NOT NULL,
      "skipped" numeric DEFAULT 0 NOT NULL,
      "errored" numeric DEFAULT 0 NOT NULL,
      "payload_snapshot" jsonb NOT NULL,
      "results" jsonb,
      "error" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "product_imports"
        ADD CONSTRAINT "product_imports_requested_by_id_users_id_fk"
        FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "product_imports_status_idx" ON "product_imports" USING btree ("status");
    CREATE UNIQUE INDEX IF NOT EXISTS "product_imports_idempotency_key_idx" ON "product_imports" USING btree ("idempotency_key");
    CREATE INDEX IF NOT EXISTS "product_imports_requested_by_idx" ON "product_imports" USING btree ("requested_by_id");
    CREATE INDEX IF NOT EXISTS "product_imports_requested_at_idx" ON "product_imports" USING btree ("requested_at");
    CREATE INDEX IF NOT EXISTS "product_imports_updated_at_idx" ON "product_imports" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "product_imports_created_at_idx" ON "product_imports" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "product_imports_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_product_imports_fk"
        FOREIGN KEY ("product_imports_id") REFERENCES "public"."product_imports"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_product_imports_id_idx"
      ON "payload_locked_documents_rels" USING btree ("product_imports_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_product_imports_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_product_imports_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "product_imports_id";

    DROP INDEX IF EXISTS "product_imports_created_at_idx";
    DROP INDEX IF EXISTS "product_imports_updated_at_idx";
    DROP INDEX IF EXISTS "product_imports_requested_at_idx";
    DROP INDEX IF EXISTS "product_imports_requested_by_idx";
    DROP INDEX IF EXISTS "product_imports_idempotency_key_idx";
    DROP INDEX IF EXISTS "product_imports_status_idx";
    DROP TABLE IF EXISTS "product_imports";
    DROP TYPE IF EXISTS "public"."enum_product_imports_status";

    DROP INDEX IF EXISTS "media_source_sha256_idx";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "source_sha256";

    -- PostgreSQL não remove valores individuais de ENUM com segurança. Os valores
    -- 'productImport' permanecem nos ENUMs internos de jobs após rollback; sem a
    -- task registrada eles ficam inertes e não afetam a execução.
  `)
}
