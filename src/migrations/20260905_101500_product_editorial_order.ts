import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "order" numeric DEFAULT 100000;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_order" numeric DEFAULT 100000;

    WITH ranked AS (
      SELECT "id", row_number() OVER (ORDER BY "created_at", "id") * 100 AS next_order
      FROM "products"
    )
    UPDATE "products"
      SET "order" = ranked.next_order
      FROM ranked
      WHERE "products"."id" = ranked."id";

    UPDATE "_products_v" AS versions
      SET "version_order" = products."order"
      FROM "products" AS products
      WHERE versions."parent_id" = products."id";

    CREATE INDEX IF NOT EXISTS "products_order_idx" ON "products" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "_products_v_version_order_idx" ON "_products_v" USING btree ("version_order");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "products_order_idx";
    DROP INDEX IF EXISTS "_products_v_version_order_idx";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "order";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_order";
  `)
}
