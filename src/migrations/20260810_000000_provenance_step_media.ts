import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "home_provenance_steps"
      ADD COLUMN "image_image_id" integer,
      ADD COLUMN "image_alt" varchar,
      ADD COLUMN "image_caption" varchar,
      ADD COLUMN "link_label" varchar,
      ADD COLUMN "link_destination_type" "dest_type" DEFAULT 'internal',
      ADD COLUMN "link_path" varchar,
      ADD COLUMN "link_url" varchar;

    ALTER TABLE "_home_v_version_provenance_steps"
      ADD COLUMN "image_image_id" integer,
      ADD COLUMN "image_alt" varchar,
      ADD COLUMN "image_caption" varchar,
      ADD COLUMN "link_label" varchar,
      ADD COLUMN "link_destination_type" "dest_type" DEFAULT 'internal',
      ADD COLUMN "link_path" varchar,
      ADD COLUMN "link_url" varchar;

    ALTER TABLE "home_provenance_steps"
      ADD CONSTRAINT "home_provenance_steps_image_image_id_media_id_fk"
      FOREIGN KEY ("image_image_id") REFERENCES "public"."media"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "_home_v_version_provenance_steps"
      ADD CONSTRAINT "_home_v_version_provenance_steps_image_image_id_media_id_fk"
      FOREIGN KEY ("image_image_id") REFERENCES "public"."media"("id")
      ON DELETE set null ON UPDATE no action;

    CREATE INDEX "home_provenance_steps_image_image_image_idx"
      ON "home_provenance_steps" USING btree ("image_image_id");

    CREATE INDEX "_home_v_version_provenance_steps_image_image_image_idx"
      ON "_home_v_version_provenance_steps" USING btree ("image_image_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "home_provenance_steps_image_image_image_idx";
    DROP INDEX IF EXISTS "_home_v_version_provenance_steps_image_image_image_idx";

    ALTER TABLE "home_provenance_steps"
      DROP CONSTRAINT IF EXISTS "home_provenance_steps_image_image_id_media_id_fk";

    ALTER TABLE "_home_v_version_provenance_steps"
      DROP CONSTRAINT IF EXISTS "_home_v_version_provenance_steps_image_image_id_media_id_fk";

    ALTER TABLE "home_provenance_steps"
      DROP COLUMN IF EXISTS "image_image_id",
      DROP COLUMN IF EXISTS "image_alt",
      DROP COLUMN IF EXISTS "image_caption",
      DROP COLUMN IF EXISTS "link_label",
      DROP COLUMN IF EXISTS "link_destination_type",
      DROP COLUMN IF EXISTS "link_path",
      DROP COLUMN IF EXISTS "link_url";

    ALTER TABLE "_home_v_version_provenance_steps"
      DROP COLUMN IF EXISTS "image_image_id",
      DROP COLUMN IF EXISTS "image_alt",
      DROP COLUMN IF EXISTS "image_caption",
      DROP COLUMN IF EXISTS "link_label",
      DROP COLUMN IF EXISTS "link_destination_type",
      DROP COLUMN IF EXISTS "link_path",
      DROP COLUMN IF EXISTS "link_url";
  `)
}
