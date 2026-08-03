import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_home_disabled_sections" AS ENUM(
      'hero',
      'manifesto',
      'selectedObjects',
      'matter',
      'signature',
      'matterInterlude',
      'provenance',
      'privateInvitation'
    );

    CREATE TYPE "public"."enum__home_v_version_disabled_sections" AS ENUM(
      'hero',
      'manifesto',
      'selectedObjects',
      'matter',
      'signature',
      'matterInterlude',
      'provenance',
      'privateInvitation'
    );

    CREATE TABLE "home_disabled_sections" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_home_disabled_sections",
      "id" serial PRIMARY KEY NOT NULL
    );

    CREATE TABLE "_home_v_version_disabled_sections" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum__home_v_version_disabled_sections",
      "id" serial PRIMARY KEY NOT NULL
    );

    ALTER TABLE "site_settings" ADD COLUMN "footer_statement" varchar;
    ALTER TABLE "site_settings" ADD COLUMN "location_label" varchar;
    ALTER TABLE "site_settings" ADD COLUMN "privacy_label" varchar;
    ALTER TABLE "site_settings" ADD COLUMN "privacy_href" varchar;
    ALTER TABLE "site_settings" ADD COLUMN "terms_label" varchar;
    ALTER TABLE "site_settings" ADD COLUMN "terms_href" varchar;

    ALTER TABLE "_site_settings_v" ADD COLUMN "version_footer_statement" varchar;
    ALTER TABLE "_site_settings_v" ADD COLUMN "version_location_label" varchar;
    ALTER TABLE "_site_settings_v" ADD COLUMN "version_privacy_label" varchar;
    ALTER TABLE "_site_settings_v" ADD COLUMN "version_privacy_href" varchar;
    ALTER TABLE "_site_settings_v" ADD COLUMN "version_terms_label" varchar;
    ALTER TABLE "_site_settings_v" ADD COLUMN "version_terms_href" varchar;

    ALTER TABLE "home_disabled_sections"
      ADD CONSTRAINT "home_disabled_sections_parent_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."home"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "_home_v_version_disabled_sections"
      ADD CONSTRAINT "_home_v_version_disabled_sections_parent_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."_home_v"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "home_disabled_sections_order_idx"
      ON "home_disabled_sections" USING btree ("order");
    CREATE INDEX "home_disabled_sections_parent_idx"
      ON "home_disabled_sections" USING btree ("parent_id");
    CREATE INDEX "_home_v_version_disabled_sections_order_idx"
      ON "_home_v_version_disabled_sections" USING btree ("order");
    CREATE INDEX "_home_v_version_disabled_sections_parent_idx"
      ON "_home_v_version_disabled_sections" USING btree ("parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "_home_v_version_disabled_sections" CASCADE;
    DROP TABLE "home_disabled_sections" CASCADE;

    ALTER TABLE "_site_settings_v" DROP COLUMN "version_footer_statement";
    ALTER TABLE "_site_settings_v" DROP COLUMN "version_location_label";
    ALTER TABLE "_site_settings_v" DROP COLUMN "version_privacy_label";
    ALTER TABLE "_site_settings_v" DROP COLUMN "version_privacy_href";
    ALTER TABLE "_site_settings_v" DROP COLUMN "version_terms_label";
    ALTER TABLE "_site_settings_v" DROP COLUMN "version_terms_href";

    ALTER TABLE "site_settings" DROP COLUMN "footer_statement";
    ALTER TABLE "site_settings" DROP COLUMN "location_label";
    ALTER TABLE "site_settings" DROP COLUMN "privacy_label";
    ALTER TABLE "site_settings" DROP COLUMN "privacy_href";
    ALTER TABLE "site_settings" DROP COLUMN "terms_label";
    ALTER TABLE "site_settings" DROP COLUMN "terms_href";

    DROP TYPE "public"."enum__home_v_version_disabled_sections";
    DROP TYPE "public"."enum_home_disabled_sections";
  `)
}
