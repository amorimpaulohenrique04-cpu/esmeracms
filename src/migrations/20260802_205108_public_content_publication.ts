import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__media_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_site_settings_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__site_settings_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "_media_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_alt" varchar,
  	"version_caption" varchar,
  	"version_credit" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__media_v_version_status" DEFAULT 'draft',
  	"version_url" varchar,
  	"version_thumbnail_u_r_l" varchar,
  	"version_filename" varchar,
  	"version_mime_type" varchar,
  	"version_filesize" numeric,
  	"version_width" numeric,
  	"version_height" numeric,
  	"version_focal_x" numeric,
  	"version_focal_y" numeric,
  	"version_sizes_thumb_url" varchar,
  	"version_sizes_thumb_width" numeric,
  	"version_sizes_thumb_height" numeric,
  	"version_sizes_thumb_mime_type" varchar,
  	"version_sizes_thumb_filesize" numeric,
  	"version_sizes_thumb_filename" varchar,
  	"version_sizes_card_url" varchar,
  	"version_sizes_card_width" numeric,
  	"version_sizes_card_height" numeric,
  	"version_sizes_card_mime_type" varchar,
  	"version_sizes_card_filesize" numeric,
  	"version_sizes_card_filename" varchar,
  	"version_sizes_wide_url" varchar,
  	"version_sizes_wide_width" numeric,
  	"version_sizes_wide_height" numeric,
  	"version_sizes_wide_mime_type" varchar,
  	"version_sizes_wide_filesize" numeric,
  	"version_sizes_wide_filename" varchar,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "media" ALTER COLUMN "alt" DROP NOT NULL;
  ALTER TABLE "site_settings_official_channels" ALTER COLUMN "label" DROP NOT NULL;
  ALTER TABLE "site_settings_official_channels" ALTER COLUMN "kind" DROP NOT NULL;
  ALTER TABLE "site_settings_official_channels" ALTER COLUMN "value" DROP NOT NULL;
  ALTER TABLE "_site_settings_v_version_official_channels" ALTER COLUMN "label" DROP NOT NULL;
  ALTER TABLE "_site_settings_v_version_official_channels" ALTER COLUMN "kind" DROP NOT NULL;
  ALTER TABLE "_site_settings_v_version_official_channels" ALTER COLUMN "value" DROP NOT NULL;
  ALTER TABLE "media" ADD COLUMN "_status" "enum_media_status" DEFAULT 'draft';
  ALTER TABLE "site_settings" ADD COLUMN "_status" "enum_site_settings_status" DEFAULT 'draft';
  ALTER TABLE "_site_settings_v" ADD COLUMN "version__status" "enum__site_settings_v_version_status" DEFAULT 'draft';
  ALTER TABLE "_site_settings_v" ADD COLUMN "latest" boolean;
  UPDATE "media" SET "_status" = 'published';
  UPDATE "site_settings" SET "_status" = 'published';
  UPDATE "_site_settings_v" SET "version__status" = 'published';
  ALTER TABLE "_media_v" ADD CONSTRAINT "_media_v_parent_id_media_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "_media_v_parent_idx" ON "_media_v" USING btree ("parent_id");
  CREATE INDEX "_media_v_version_version_updated_at_idx" ON "_media_v" USING btree ("version_updated_at");
  CREATE INDEX "_media_v_version_version_created_at_idx" ON "_media_v" USING btree ("version_created_at");
  CREATE INDEX "_media_v_version_version__status_idx" ON "_media_v" USING btree ("version__status");
  CREATE INDEX "_media_v_version_version_filename_idx" ON "_media_v" USING btree ("version_filename");
  CREATE INDEX "_media_v_version_sizes_thumb_version_sizes_thumb_filenam_idx" ON "_media_v" USING btree ("version_sizes_thumb_filename");
  CREATE INDEX "_media_v_version_sizes_card_version_sizes_card_filename_idx" ON "_media_v" USING btree ("version_sizes_card_filename");
  CREATE INDEX "_media_v_version_sizes_wide_version_sizes_wide_filename_idx" ON "_media_v" USING btree ("version_sizes_wide_filename");
  CREATE INDEX "_media_v_created_at_idx" ON "_media_v" USING btree ("created_at");
  CREATE INDEX "_media_v_updated_at_idx" ON "_media_v" USING btree ("updated_at");
  CREATE INDEX "_media_v_latest_idx" ON "_media_v" USING btree ("latest");
  CREATE INDEX "media__status_idx" ON "media" USING btree ("_status");
  CREATE INDEX "site_settings__status_idx" ON "site_settings" USING btree ("_status");
  CREATE INDEX "_site_settings_v_version_version__status_idx" ON "_site_settings_v" USING btree ("version__status");
  CREATE INDEX "_site_settings_v_latest_idx" ON "_site_settings_v" USING btree ("latest");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_media_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "_media_v" CASCADE;
  DROP INDEX "media__status_idx";
  DROP INDEX "site_settings__status_idx";
  DROP INDEX "_site_settings_v_version_version__status_idx";
  DROP INDEX "_site_settings_v_latest_idx";
  ALTER TABLE "media" ALTER COLUMN "alt" SET NOT NULL;
  ALTER TABLE "site_settings_official_channels" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "site_settings_official_channels" ALTER COLUMN "kind" SET NOT NULL;
  ALTER TABLE "site_settings_official_channels" ALTER COLUMN "value" SET NOT NULL;
  ALTER TABLE "_site_settings_v_version_official_channels" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "_site_settings_v_version_official_channels" ALTER COLUMN "kind" SET NOT NULL;
  ALTER TABLE "_site_settings_v_version_official_channels" ALTER COLUMN "value" SET NOT NULL;
  ALTER TABLE "media" DROP COLUMN "_status";
  ALTER TABLE "site_settings" DROP COLUMN "_status";
  ALTER TABLE "_site_settings_v" DROP COLUMN "version__status";
  ALTER TABLE "_site_settings_v" DROP COLUMN "latest";
  DROP TYPE "public"."enum_media_status";
  DROP TYPE "public"."enum__media_v_version_status";
  DROP TYPE "public"."enum_site_settings_status";
  DROP TYPE "public"."enum__site_settings_v_version_status";`)
}
