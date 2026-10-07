import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Snapshot opcional da personalização de quadrinhos em cada item da venda.
 * O storefront finaliza por WhatsApp; quando a venda é registrada no CMS estes
 * campos preservam exatamente tamanho, acabamento e texto acordados.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_sales_items_personalization_kind" AS ENUM('frame_text');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_sales_items_personalization_frame_size" AS ENUM('10x10', '15x15', '20x20');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_sales_items_personalization_finish" AS ENUM('silver', 'gold');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_sales_items_personalization_text_mode" AS ENUM('preset', 'custom');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__sales_v_version_items_personalization_kind" AS ENUM('frame_text');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum__sales_v_version_items_personalization_frame_size" AS ENUM('10x10', '15x15', '20x20');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum__sales_v_version_items_personalization_finish" AS ENUM('silver', 'gold');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum__sales_v_version_items_personalization_text_mode" AS ENUM('preset', 'custom');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "sales_items"
      ADD COLUMN IF NOT EXISTS "personalization_kind" "enum_sales_items_personalization_kind",
      ADD COLUMN IF NOT EXISTS "personalization_frame_size" "enum_sales_items_personalization_frame_size",
      ADD COLUMN IF NOT EXISTS "personalization_finish" "enum_sales_items_personalization_finish",
      ADD COLUMN IF NOT EXISTS "personalization_text_mode" "enum_sales_items_personalization_text_mode",
      ADD COLUMN IF NOT EXISTS "personalization_text" varchar;

    ALTER TABLE "_sales_v_version_items"
      ADD COLUMN IF NOT EXISTS "personalization_kind" "enum__sales_v_version_items_personalization_kind",
      ADD COLUMN IF NOT EXISTS "personalization_frame_size" "enum__sales_v_version_items_personalization_frame_size",
      ADD COLUMN IF NOT EXISTS "personalization_finish" "enum__sales_v_version_items_personalization_finish",
      ADD COLUMN IF NOT EXISTS "personalization_text_mode" "enum__sales_v_version_items_personalization_text_mode",
      ADD COLUMN IF NOT EXISTS "personalization_text" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "sales_items"
      DROP COLUMN IF EXISTS "personalization_kind",
      DROP COLUMN IF EXISTS "personalization_frame_size",
      DROP COLUMN IF EXISTS "personalization_finish",
      DROP COLUMN IF EXISTS "personalization_text_mode",
      DROP COLUMN IF EXISTS "personalization_text";

    ALTER TABLE "_sales_v_version_items"
      DROP COLUMN IF EXISTS "personalization_kind",
      DROP COLUMN IF EXISTS "personalization_frame_size",
      DROP COLUMN IF EXISTS "personalization_finish",
      DROP COLUMN IF EXISTS "personalization_text_mode",
      DROP COLUMN IF EXISTS "personalization_text";

    DROP TYPE IF EXISTS "public"."enum_sales_items_personalization_kind";
    DROP TYPE IF EXISTS "public"."enum_sales_items_personalization_frame_size";
    DROP TYPE IF EXISTS "public"."enum_sales_items_personalization_finish";
    DROP TYPE IF EXISTS "public"."enum_sales_items_personalization_text_mode";
    DROP TYPE IF EXISTS "public"."enum__sales_v_version_items_personalization_kind";
    DROP TYPE IF EXISTS "public"."enum__sales_v_version_items_personalization_frame_size";
    DROP TYPE IF EXISTS "public"."enum__sales_v_version_items_personalization_finish";
    DROP TYPE IF EXISTS "public"."enum__sales_v_version_items_personalization_text_mode";
  `)
}
