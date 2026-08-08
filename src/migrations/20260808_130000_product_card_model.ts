import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * PR1 — Modelo do card de produto.
 *
 * 1. Separa "peça única" da disponibilidade: `availability = 'unique'` deixa de
 *    representar estado e vira característica (`edition = 'Peça única'`). O valor
 *    `unique` continua no enum durante a transição; sua remoção é uma etapa futura.
 * 2. Adiciona specs físicas estruturadas ao produto (`physical_specs_*`).
 * 3. Adiciona a política central de parcelamento em site-settings (`payment_terms_*`).
 * 4. Adiciona o crop `productCard` (3:4) à mídia (`sizes_product_card_*`).
 *
 * Convenções de coluna seguem as migrações já existentes deste repositório
 * (grupos achatados em snake_case, tabelas de versão com prefixo `version_`).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 2. Specs físicas estruturadas -----------------------------------------
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "physical_specs_height_mm" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "physical_specs_width_mm" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "physical_specs_depth_mm" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "physical_specs_weight_grams" numeric;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_physical_specs_height_mm" numeric;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_physical_specs_width_mm" numeric;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_physical_specs_depth_mm" numeric;
    ALTER TABLE "_products_v" ADD COLUMN IF NOT EXISTS "version_physical_specs_weight_grams" numeric;

    -- 3. Política central de parcelamento ------------------------------------
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "payment_terms_max_installments" numeric DEFAULT 12;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "payment_terms_interest_free_installments" numeric DEFAULT 12;
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "payment_terms_minimum_installment_cents" numeric DEFAULT 0;
    ALTER TABLE "_site_settings_v" ADD COLUMN IF NOT EXISTS "version_payment_terms_max_installments" numeric DEFAULT 12;
    ALTER TABLE "_site_settings_v" ADD COLUMN IF NOT EXISTS "version_payment_terms_interest_free_installments" numeric DEFAULT 12;
    ALTER TABLE "_site_settings_v" ADD COLUMN IF NOT EXISTS "version_payment_terms_minimum_installment_cents" numeric DEFAULT 0;

    -- 4. Crop productCard (3:4) na mídia --------------------------------------
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_product_card_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_product_card_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_product_card_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_product_card_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_product_card_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_product_card_filename" varchar;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_product_card_url" varchar;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_product_card_width" numeric;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_product_card_height" numeric;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_product_card_mime_type" varchar;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_product_card_filesize" numeric;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_product_card_filename" varchar;
    CREATE INDEX IF NOT EXISTS "media_sizes_product_card_sizes_product_card_filename_idx" ON "media" USING btree ("sizes_product_card_filename");
    CREATE INDEX IF NOT EXISTS "_media_v_version_sizes_product_card_filename_idx" ON "_media_v" USING btree ("version_sizes_product_card_filename");

    -- 1. Migração de dados: unique -> edition + available ---------------------
    -- Preserva a semântica "peça única" na Edição antes de liberar o estado.
    UPDATE "products"
      SET "edition" = 'Peça única'
      WHERE "availability" = 'unique' AND ("edition" IS NULL OR btrim("edition") = '');
    UPDATE "products"
      SET "availability" = 'available'
      WHERE "availability" = 'unique';

    UPDATE "_products_v"
      SET "version_edition" = 'Peça única'
      WHERE "version_availability" = 'unique' AND ("version_edition" IS NULL OR btrim("version_edition") = '');
    UPDATE "_products_v"
      SET "version_availability" = 'available'
      WHERE "version_availability" = 'unique';

    -- Preenche a política de parcelamento existente com os padrões.
    UPDATE "site_settings"
      SET "payment_terms_max_installments" = COALESCE("payment_terms_max_installments", 12),
          "payment_terms_interest_free_installments" = COALESCE("payment_terms_interest_free_installments", 12),
          "payment_terms_minimum_installment_cents" = COALESCE("payment_terms_minimum_installment_cents", 0);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reversão de schema apenas. A migração de dados unique->available não é
  // reconstituível com segurança (não há como saber quais peças eram `unique`
  // depois que o estado foi normalizado), então os dados não são revertidos.
  await db.execute(sql`
    DROP INDEX IF EXISTS "media_sizes_product_card_sizes_product_card_filename_idx";
    DROP INDEX IF EXISTS "_media_v_version_sizes_product_card_filename_idx";

    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_product_card_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_product_card_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_product_card_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_product_card_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_product_card_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_product_card_filename";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_product_card_url";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_product_card_width";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_product_card_height";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_product_card_mime_type";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_product_card_filesize";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_product_card_filename";

    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "payment_terms_max_installments";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "payment_terms_interest_free_installments";
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "payment_terms_minimum_installment_cents";
    ALTER TABLE "_site_settings_v" DROP COLUMN IF EXISTS "version_payment_terms_max_installments";
    ALTER TABLE "_site_settings_v" DROP COLUMN IF EXISTS "version_payment_terms_interest_free_installments";
    ALTER TABLE "_site_settings_v" DROP COLUMN IF EXISTS "version_payment_terms_minimum_installment_cents";

    ALTER TABLE "products" DROP COLUMN IF EXISTS "physical_specs_height_mm";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "physical_specs_width_mm";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "physical_specs_depth_mm";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "physical_specs_weight_grams";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_physical_specs_height_mm";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_physical_specs_width_mm";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_physical_specs_depth_mm";
    ALTER TABLE "_products_v" DROP COLUMN IF EXISTS "version_physical_specs_weight_grams";
  `)
}
