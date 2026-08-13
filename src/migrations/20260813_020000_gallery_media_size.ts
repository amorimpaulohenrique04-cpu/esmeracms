import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adiciona o preset de mídia `gallery` (largura máxima 1800, sem crop) usado
 * pela galeria de produto do storefront.
 *
 * Payload persiste os metadados de cada imageSize em colunas próprias tanto na
 * tabela principal quanto na tabela de versões. A configuração de `gallery`
 * precisa, portanto, de uma migração explícita no Postgres já existente.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_gallery_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_gallery_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_gallery_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_gallery_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_gallery_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_gallery_filename" varchar;

    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_gallery_url" varchar;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_gallery_width" numeric;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_gallery_height" numeric;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_gallery_mime_type" varchar;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_gallery_filesize" numeric;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_gallery_filename" varchar;

    CREATE INDEX IF NOT EXISTS "media_sizes_gallery_sizes_gallery_filename_idx"
      ON "media" USING btree ("sizes_gallery_filename");
    CREATE INDEX IF NOT EXISTS "_media_v_version_sizes_gallery_filename_idx"
      ON "_media_v" USING btree ("version_sizes_gallery_filename");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "media_sizes_gallery_sizes_gallery_filename_idx";
    DROP INDEX IF EXISTS "_media_v_version_sizes_gallery_filename_idx";

    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_gallery_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_gallery_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_gallery_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_gallery_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_gallery_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_gallery_filename";

    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_gallery_url";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_gallery_width";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_gallery_height";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_gallery_mime_type";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_gallery_filesize";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_gallery_filename";
  `)
}
