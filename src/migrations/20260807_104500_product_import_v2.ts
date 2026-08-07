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
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_source_sha256" varchar;
    CREATE INDEX IF NOT EXISTS "media_source_sha256_idx" ON "media" USING btree ("source_sha256");
    CREATE INDEX IF NOT EXISTS "media_versions_source_sha256_idx" ON "_media_v" USING btree ("version_source_sha256");

    -- Chaves normalizadas usadas pelo preview/commit para resolver duplicatas e
    -- categorias em consultas indexadas, sem varrer o catálogo inteiro.
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "code_normalized" varchar;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_code_normalized" varchar;
    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "title_normalized" varchar;
    ALTER TABLE "_categories_v" ADD COLUMN IF NOT EXISTS "version_title_normalized" varchar;

    UPDATE "products"
      SET "code_normalized" = translate(lower(trim("code")),
        'áàãâäéèêëíìîïóòõôöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc')
      WHERE "code" IS NOT NULL AND ("code_normalized" IS NULL OR "code_normalized" = '');

    UPDATE "_products_v"
      SET "version_code_normalized" = translate(lower(trim("version_code")),
        'áàãâäéèêëíìîïóòõôöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc')
      WHERE "version_code" IS NOT NULL AND ("version_code_normalized" IS NULL OR "version_code_normalized" = '');

    UPDATE "categories"
      SET "title_normalized" = translate(lower(trim("title")),
        'áàãâäéèêëíìîïóòõôöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc')
      WHERE "title" IS NOT NULL AND ("title_normalized" IS NULL OR "title_normalized" = '');

    UPDATE "_categories_v"
      SET "version_title_normalized" = translate(lower(trim("version_title")),
        'áàãâäéèêëíìîïóòõôöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc')
      WHERE "version_title" IS NOT NULL AND ("version_title_normalized" IS NULL OR "version_title_normalized" = '');

    CREATE UNIQUE INDEX IF NOT EXISTS "products_code_normalized_idx" ON "products" USING btree ("code_normalized");
    CREATE INDEX IF NOT EXISTS "products_versions_code_normalized_idx" ON "_products_v" USING btree ("version_code_normalized");
    CREATE INDEX IF NOT EXISTS "categories_title_normalized_idx" ON "categories" USING btree ("title_normalized");
    CREATE INDEX IF NOT EXISTS "categories_versions_title_normalized_idx" ON "_categories_v" USING btree ("version_title_normalized");

    CREATE TABLE IF NOT EXISTS "product_imports" (
      "id" serial PRIMARY KEY NOT NULL,
      "status" "enum_product_imports_status" NOT NULL,
      "idempotency_key" varchar NOT NULL,
      "requested_by_id" integer,
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

    DROP INDEX IF EXISTS "categories_versions_title_normalized_idx";
    DROP INDEX IF EXISTS "categories_title_normalized_idx";
    DROP INDEX IF EXISTS "products_versions_code_normalized_idx";
    DROP INDEX IF EXISTS "products_code_normalized_idx";
    ALTER TABLE "_categories_v" DROP COLUMN IF EXISTS "version_title_normalized";
    ALTER TABLE "categories" DROP COLUMN IF EXISTS "title_normalized";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_code_normalized";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "code_normalized";

    DROP INDEX IF EXISTS "media_versions_source_sha256_idx";
    DROP INDEX IF EXISTS "media_source_sha256_idx";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_source_sha256";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "source_sha256";

    -- PostgreSQL não remove valores individuais de ENUM com segurança. Os valores
    -- 'productImport' permanecem nos ENUMs internos de jobs após rollback; sem a
    -- task registrada eles ficam inertes e não afetam a execução.
  `)
}
