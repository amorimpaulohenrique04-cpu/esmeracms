import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "publication_revision" varchar;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "publication_contract_version" varchar;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_publication_revision" varchar;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_publication_contract_version" varchar;

    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "publication_revision" varchar;
    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "publication_contract_version" varchar;
    ALTER TABLE "_categories_v" ADD COLUMN IF NOT EXISTS "version_publication_revision" varchar;
    ALTER TABLE "_categories_v" ADD COLUMN IF NOT EXISTS "version_publication_contract_version" varchar;

    ALTER TABLE "home" ADD COLUMN IF NOT EXISTS "publication_revision" varchar;
    ALTER TABLE "home" ADD COLUMN IF NOT EXISTS "publication_contract_version" varchar;
    ALTER TABLE "_home_v" ADD COLUMN IF NOT EXISTS "version_publication_revision" varchar;
    ALTER TABLE "_home_v" ADD COLUMN IF NOT EXISTS "version_publication_contract_version" varchar;

    CREATE INDEX IF NOT EXISTS "products_publication_revision_idx"
      ON "products" USING btree ("publication_revision");
    CREATE INDEX IF NOT EXISTS "categories_publication_revision_idx"
      ON "categories" USING btree ("publication_revision");
    CREATE INDEX IF NOT EXISTS "home_publication_revision_idx"
      ON "home" USING btree ("publication_revision");
  `)
}

// Rollback removes only the additive metadata columns and their indexes.
// Editorial content and historical version rows are preserved.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "home_publication_revision_idx";
    DROP INDEX IF EXISTS "categories_publication_revision_idx";
    DROP INDEX IF EXISTS "products_publication_revision_idx";

    ALTER TABLE "_home_v" DROP COLUMN IF EXISTS "version_publication_contract_version";
    ALTER TABLE "_home_v" DROP COLUMN IF EXISTS "version_publication_revision";
    ALTER TABLE "home" DROP COLUMN IF EXISTS "publication_contract_version";
    ALTER TABLE "home" DROP COLUMN IF EXISTS "publication_revision";

    ALTER TABLE "_categories_v" DROP COLUMN IF EXISTS "version_publication_contract_version";
    ALTER TABLE "_categories_v" DROP COLUMN IF EXISTS "version_publication_revision";
    ALTER TABLE "categories" DROP COLUMN IF EXISTS "publication_contract_version";
    ALTER TABLE "categories" DROP COLUMN IF EXISTS "publication_revision";

    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_publication_contract_version";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_publication_revision";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "publication_contract_version";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "publication_revision";
  `)
}
