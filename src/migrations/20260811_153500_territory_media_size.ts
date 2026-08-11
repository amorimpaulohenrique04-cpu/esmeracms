import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adiciona o preset de mídia `territory` (5:9, 1200x2160) usado pelos painéis
 * editoriais Matter/Território do storefront.
 *
 * Payload persiste os metadados de cada imageSize em colunas próprias tanto na
 * tabela principal quanto na tabela de versões, por isso a mudança de config
 * precisa acompanhar uma migração explícita no Postgres existente.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_territory_url" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_territory_width" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_territory_height" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_territory_mime_type" varchar;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_territory_filesize" numeric;
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_territory_filename" varchar;

    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_territory_url" varchar;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_territory_width" numeric;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_territory_height" numeric;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_territory_mime_type" varchar;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_territory_filesize" numeric;
    ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS "version_sizes_territory_filename" varchar;

    CREATE INDEX IF NOT EXISTS "media_sizes_territory_sizes_territory_filename_idx"
      ON "media" USING btree ("sizes_territory_filename");
    CREATE INDEX IF NOT EXISTS "_media_v_version_sizes_territory_filename_idx"
      ON "_media_v" USING btree ("version_sizes_territory_filename");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "media_sizes_territory_sizes_territory_filename_idx";
    DROP INDEX IF EXISTS "_media_v_version_sizes_territory_filename_idx";

    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_territory_url";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_territory_width";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_territory_height";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_territory_mime_type";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_territory_filesize";
    ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_territory_filename";

    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_territory_url";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_territory_width";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_territory_height";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_territory_mime_type";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_territory_filesize";
    ALTER TABLE "_media_v" DROP COLUMN IF EXISTS "version_sizes_territory_filename";
  `)
}
