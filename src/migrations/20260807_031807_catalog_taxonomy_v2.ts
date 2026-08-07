import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_categories_listing_rules_availability" AS ENUM('unique', 'available', 'made_to_order', 'limited');
  CREATE TYPE "public"."enum_categories_listing_rules_product_status" AS ENUM('active', 'archived');
  CREATE TYPE "public"."enum_categories_collection_page_visible_filters" AS ENUM('category', 'collection', 'environment', 'piece_type', 'material', 'availability', 'price');
  CREATE TYPE "public"."enum_categories_blocks_rich_text_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum_categories_blocks_image_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum_categories_blocks_image_text_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum_categories_blocks_image_text_image_position" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_categories_blocks_manifesto_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum_categories_blocks_material_highlight_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum_categories_blocks_cta_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum_categories_blocks_gallery_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum_categories_blocks_divider_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum_categories_node_type" AS ENUM('collection', 'editorial', 'external', 'group');
  CREATE TYPE "public"."enum_categories_taxonomy_axis" AS ENUM('navigation', 'piece_type', 'collection', 'environment', 'campaign', 'service');
  CREATE TYPE "public"."enum_categories_menu_visibility" AS ENUM('all', 'desktop', 'mobile');
  CREATE TYPE "public"."enum_categories_listing_mode" AS ENUM('assigned', 'descendants', 'rules', 'hybrid');
  CREATE TYPE "public"."enum_categories_listing_rules_sort" AS ENUM('editorial', 'newest', 'price_asc', 'price_desc', 'name_asc');
  CREATE TYPE "public"."enum_categories_collection_page_default_sort" AS ENUM('editorial', 'newest', 'price_asc', 'price_desc', 'name_asc');
  CREATE TYPE "public"."enum_categories_collection_page_layout" AS ENUM('grid', 'editorial');
  CREATE TYPE "public"."enum__categories_v_version_listing_rules_availability" AS ENUM('unique', 'available', 'made_to_order', 'limited');
  CREATE TYPE "public"."enum__categories_v_version_listing_rules_product_status" AS ENUM('active', 'archived');
  CREATE TYPE "public"."enum__categories_v_version_collection_page_visible_filters" AS ENUM('category', 'collection', 'environment', 'piece_type', 'material', 'availability', 'price');
  CREATE TYPE "public"."enum__categories_v_blocks_rich_text_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum__categories_v_blocks_image_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum__categories_v_blocks_image_text_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum__categories_v_blocks_image_text_image_position" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum__categories_v_blocks_manifesto_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum__categories_v_blocks_material_highlight_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum__categories_v_blocks_cta_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum__categories_v_blocks_gallery_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum__categories_v_blocks_divider_placement" AS ENUM('before', 'after');
  CREATE TYPE "public"."enum__categories_v_version_node_type" AS ENUM('collection', 'editorial', 'external', 'group');
  CREATE TYPE "public"."enum__categories_v_version_taxonomy_axis" AS ENUM('navigation', 'piece_type', 'collection', 'environment', 'campaign', 'service');
  CREATE TYPE "public"."enum__categories_v_version_menu_visibility" AS ENUM('all', 'desktop', 'mobile');
  CREATE TYPE "public"."enum__categories_v_version_listing_mode" AS ENUM('assigned', 'descendants', 'rules', 'hybrid');
  CREATE TYPE "public"."enum__categories_v_version_listing_rules_sort" AS ENUM('editorial', 'newest', 'price_asc', 'price_desc', 'name_asc');
  CREATE TYPE "public"."enum__categories_v_version_collection_page_default_sort" AS ENUM('editorial', 'newest', 'price_asc', 'price_desc', 'name_asc');
  CREATE TYPE "public"."enum__categories_v_version_collection_page_layout" AS ENUM('grid', 'editorial');
  CREATE TYPE "public"."enum_navigation_roots_desktop_mode" AS ENUM('mega', 'link');
  CREATE TYPE "public"."enum_navigation_roots_mobile_mode" AS ENUM('drilldown', 'link');
  CREATE TYPE "public"."enum__navigation_v_version_roots_desktop_mode" AS ENUM('mega', 'link');
  CREATE TYPE "public"."enum__navigation_v_version_roots_mobile_mode" AS ENUM('drilldown', 'link');
  CREATE TABLE "categories_listing_rules_availability" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_categories_listing_rules_availability",
  	"id" serial PRIMARY KEY NOT NULL
  );
  CREATE TABLE "categories_listing_rules_materials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  CREATE TABLE "categories_listing_rules_product_status" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_categories_listing_rules_product_status",
  	"id" serial PRIMARY KEY NOT NULL
  );
  CREATE TABLE "categories_collection_page_visible_filters" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_categories_collection_page_visible_filters",
  	"id" serial PRIMARY KEY NOT NULL
  );
  CREATE TABLE "categories_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"placement" "enum_categories_blocks_rich_text_placement" DEFAULT 'before',
  	"content" jsonb,
  	"block_name" varchar
  );
  CREATE TABLE "categories_blocks_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"placement" "enum_categories_blocks_image_placement" DEFAULT 'before',
  	"image_id" integer,
  	"alt" varchar,
  	"caption" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "categories_blocks_image_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"placement" "enum_categories_blocks_image_text_placement" DEFAULT 'before',
  	"eyebrow" varchar,
  	"title" varchar,
  	"copy" varchar,
  	"image_id" integer,
  	"image_position" "enum_categories_blocks_image_text_image_position" DEFAULT 'left',
  	"block_name" varchar
  );
  CREATE TABLE "categories_blocks_manifesto" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"placement" "enum_categories_blocks_manifesto_placement" DEFAULT 'before',
  	"eyebrow" varchar,
  	"title" varchar,
  	"copy" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "categories_blocks_material_highlight" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"placement" "enum_categories_blocks_material_highlight_placement" DEFAULT 'before',
  	"material" varchar,
  	"title" varchar,
  	"copy" varchar,
  	"image_id" integer,
  	"block_name" varchar
  );
  CREATE TABLE "categories_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"placement" "enum_categories_blocks_cta_placement" DEFAULT 'before',
  	"title" varchar,
  	"copy" varchar,
  	"label" varchar,
  	"destination_id" integer,
  	"external_u_r_l" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "categories_blocks_gallery_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar
  );
  CREATE TABLE "categories_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"placement" "enum_categories_blocks_gallery_placement" DEFAULT 'before',
  	"block_name" varchar
  );
  CREATE TABLE "categories_blocks_divider" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"placement" "enum_categories_blocks_divider_placement" DEFAULT 'before',
  	"label" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "categories_menu_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"eyebrow" varchar,
  	"description" varchar,
  	"image_id" integer,
  	"link_label" varchar,
  	"destination_id" integer,
  	"external_u_r_l" varchar
  );
  CREATE TABLE "_categories_v_version_listing_rules_availability" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__categories_v_version_listing_rules_availability",
  	"id" serial PRIMARY KEY NOT NULL
  );
  CREATE TABLE "_categories_v_version_listing_rules_materials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"_uuid" varchar
  );
  CREATE TABLE "_categories_v_version_listing_rules_product_status" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__categories_v_version_listing_rules_product_status",
  	"id" serial PRIMARY KEY NOT NULL
  );
  CREATE TABLE "_categories_v_version_collection_page_visible_filters" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__categories_v_version_collection_page_visible_filters",
  	"id" serial PRIMARY KEY NOT NULL
  );
  CREATE TABLE "_categories_v_blocks_rich_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"placement" "enum__categories_v_blocks_rich_text_placement" DEFAULT 'before',
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "_categories_v_blocks_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"placement" "enum__categories_v_blocks_image_placement" DEFAULT 'before',
  	"image_id" integer,
  	"alt" varchar,
  	"caption" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "_categories_v_blocks_image_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"placement" "enum__categories_v_blocks_image_text_placement" DEFAULT 'before',
  	"eyebrow" varchar,
  	"title" varchar,
  	"copy" varchar,
  	"image_id" integer,
  	"image_position" "enum__categories_v_blocks_image_text_image_position" DEFAULT 'left',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "_categories_v_blocks_manifesto" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"placement" "enum__categories_v_blocks_manifesto_placement" DEFAULT 'before',
  	"eyebrow" varchar,
  	"title" varchar,
  	"copy" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "_categories_v_blocks_material_highlight" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"placement" "enum__categories_v_blocks_material_highlight_placement" DEFAULT 'before',
  	"material" varchar,
  	"title" varchar,
  	"copy" varchar,
  	"image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "_categories_v_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"placement" "enum__categories_v_blocks_cta_placement" DEFAULT 'before',
  	"title" varchar,
  	"copy" varchar,
  	"label" varchar,
  	"destination_id" integer,
  	"external_u_r_l" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "_categories_v_blocks_gallery_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar,
  	"_uuid" varchar
  );
  CREATE TABLE "_categories_v_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"placement" "enum__categories_v_blocks_gallery_placement" DEFAULT 'before',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "_categories_v_blocks_divider" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"placement" "enum__categories_v_blocks_divider_placement" DEFAULT 'before',
  	"label" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  CREATE TABLE "_categories_v_version_menu_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"eyebrow" varchar,
  	"description" varchar,
  	"image_id" integer,
  	"link_label" varchar,
  	"destination_id" integer,
  	"external_u_r_l" varchar,
  	"_uuid" varchar
  );
  CREATE TABLE "navigation_roots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category_id" integer,
  	"order" numeric DEFAULT 100,
  	"desktop_mode" "enum_navigation_roots_desktop_mode" DEFAULT 'mega',
  	"mobile_mode" "enum_navigation_roots_mobile_mode" DEFAULT 'drilldown',
  	"highlight_limit" numeric DEFAULT 2
  );
  CREATE TABLE "_navigation_v_version_roots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"category_id" integer,
  	"order" numeric DEFAULT 100,
  	"desktop_mode" "enum__navigation_v_version_roots_desktop_mode" DEFAULT 'mega',
  	"mobile_mode" "enum__navigation_v_version_roots_mobile_mode" DEFAULT 'drilldown',
  	"highlight_limit" numeric DEFAULT 2,
  	"_uuid" varchar
  );
  ALTER TABLE "categories" ADD COLUMN "node_type" "enum_categories_node_type" DEFAULT 'collection';
  ALTER TABLE "categories" ADD COLUMN "taxonomy_axis" "enum_categories_taxonomy_axis" DEFAULT 'navigation';
  ALTER TABLE "categories" ADD COLUMN "menu_show_in_menu" boolean DEFAULT false;
  ALTER TABLE "categories" ADD COLUMN "menu_label" varchar;
  ALTER TABLE "categories" ADD COLUMN "menu_visibility" "enum_categories_menu_visibility" DEFAULT 'all';
  ALTER TABLE "categories" ADD COLUMN "menu_icon" varchar;
  ALTER TABLE "categories" ADD COLUMN "listing_mode" "enum_categories_listing_mode" DEFAULT 'assigned';
  ALTER TABLE "categories" ADD COLUMN "listing_rules_min_price" numeric;
  ALTER TABLE "categories" ADD COLUMN "listing_rules_max_price" numeric;
  ALTER TABLE "categories" ADD COLUMN "listing_rules_published_after" timestamp(3) with time zone;
  ALTER TABLE "categories" ADD COLUMN "listing_rules_published_before" timestamp(3) with time zone;
  ALTER TABLE "categories" ADD COLUMN "listing_rules_sort" "enum_categories_listing_rules_sort";
  ALTER TABLE "categories" ADD COLUMN "collection_page_eyebrow" varchar;
  ALTER TABLE "categories" ADD COLUMN "collection_page_short_description" varchar;
  ALTER TABLE "categories" ADD COLUMN "collection_page_default_sort" "enum_categories_collection_page_default_sort" DEFAULT 'editorial';
  ALTER TABLE "categories" ADD COLUMN "collection_page_products_per_page" numeric DEFAULT 24;
  ALTER TABLE "categories" ADD COLUMN "collection_page_show_product_count" boolean DEFAULT true;
  ALTER TABLE "categories" ADD COLUMN "collection_page_layout" "enum_categories_collection_page_layout" DEFAULT 'grid';
  ALTER TABLE "categories" ADD COLUMN "external_u_r_l" varchar;
  ALTER TABLE "categories" ADD COLUMN "hub_path" varchar;
  ALTER TABLE "_categories_v" ADD COLUMN "version_node_type" "enum__categories_v_version_node_type" DEFAULT 'collection';
  ALTER TABLE "_categories_v" ADD COLUMN "version_taxonomy_axis" "enum__categories_v_version_taxonomy_axis" DEFAULT 'navigation';
  ALTER TABLE "_categories_v" ADD COLUMN "version_menu_show_in_menu" boolean DEFAULT false;
  ALTER TABLE "_categories_v" ADD COLUMN "version_menu_label" varchar;
  ALTER TABLE "_categories_v" ADD COLUMN "version_menu_visibility" "enum__categories_v_version_menu_visibility" DEFAULT 'all';
  ALTER TABLE "_categories_v" ADD COLUMN "version_menu_icon" varchar;
  ALTER TABLE "_categories_v" ADD COLUMN "version_listing_mode" "enum__categories_v_version_listing_mode" DEFAULT 'assigned';
  ALTER TABLE "_categories_v" ADD COLUMN "version_listing_rules_min_price" numeric;
  ALTER TABLE "_categories_v" ADD COLUMN "version_listing_rules_max_price" numeric;
  ALTER TABLE "_categories_v" ADD COLUMN "version_listing_rules_published_after" timestamp(3) with time zone;
  ALTER TABLE "_categories_v" ADD COLUMN "version_listing_rules_published_before" timestamp(3) with time zone;
  ALTER TABLE "_categories_v" ADD COLUMN "version_listing_rules_sort" "enum__categories_v_version_listing_rules_sort";
  ALTER TABLE "_categories_v" ADD COLUMN "version_collection_page_eyebrow" varchar;
  ALTER TABLE "_categories_v" ADD COLUMN "version_collection_page_short_description" varchar;
  ALTER TABLE "_categories_v" ADD COLUMN "version_collection_page_default_sort" "enum__categories_v_version_collection_page_default_sort" DEFAULT 'editorial';
  ALTER TABLE "_categories_v" ADD COLUMN "version_collection_page_products_per_page" numeric DEFAULT 24;
  ALTER TABLE "_categories_v" ADD COLUMN "version_collection_page_show_product_count" boolean DEFAULT true;
  ALTER TABLE "_categories_v" ADD COLUMN "version_collection_page_layout" "enum__categories_v_version_collection_page_layout" DEFAULT 'grid';
  ALTER TABLE "_categories_v" ADD COLUMN "version_external_u_r_l" varchar;
  ALTER TABLE "_categories_v" ADD COLUMN "version_hub_path" varchar;
  ALTER TABLE "categories_listing_rules_availability" ADD CONSTRAINT "categories_listing_rules_availability_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_listing_rules_materials" ADD CONSTRAINT "categories_listing_rules_materials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_listing_rules_product_status" ADD CONSTRAINT "categories_listing_rules_product_status_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_collection_page_visible_filters" ADD CONSTRAINT "categories_collection_page_visible_filters_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_blocks_rich_text" ADD CONSTRAINT "categories_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_blocks_image" ADD CONSTRAINT "categories_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_blocks_image" ADD CONSTRAINT "categories_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_blocks_image_text" ADD CONSTRAINT "categories_blocks_image_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_blocks_image_text" ADD CONSTRAINT "categories_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_blocks_manifesto" ADD CONSTRAINT "categories_blocks_manifesto_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_blocks_material_highlight" ADD CONSTRAINT "categories_blocks_material_highlight_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_blocks_material_highlight" ADD CONSTRAINT "categories_blocks_material_highlight_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_blocks_cta" ADD CONSTRAINT "categories_blocks_cta_destination_id_categories_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_blocks_cta" ADD CONSTRAINT "categories_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_blocks_gallery_items" ADD CONSTRAINT "categories_blocks_gallery_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_blocks_gallery_items" ADD CONSTRAINT "categories_blocks_gallery_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_blocks_gallery" ADD CONSTRAINT "categories_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_blocks_divider" ADD CONSTRAINT "categories_blocks_divider_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_menu_highlights" ADD CONSTRAINT "categories_menu_highlights_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_menu_highlights" ADD CONSTRAINT "categories_menu_highlights_destination_id_categories_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_menu_highlights" ADD CONSTRAINT "categories_menu_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_version_listing_rules_availability" ADD CONSTRAINT "_categories_v_version_listing_rules_availability_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_version_listing_rules_materials" ADD CONSTRAINT "_categories_v_version_listing_rules_materials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_version_listing_rules_product_status" ADD CONSTRAINT "_categories_v_version_listing_rules_product_status_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_version_collection_page_visible_filters" ADD CONSTRAINT "_categories_v_version_collection_page_visible_filters_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_rich_text" ADD CONSTRAINT "_categories_v_blocks_rich_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_image" ADD CONSTRAINT "_categories_v_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_image" ADD CONSTRAINT "_categories_v_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_image_text" ADD CONSTRAINT "_categories_v_blocks_image_text_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_image_text" ADD CONSTRAINT "_categories_v_blocks_image_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_manifesto" ADD CONSTRAINT "_categories_v_blocks_manifesto_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_material_highlight" ADD CONSTRAINT "_categories_v_blocks_material_highlight_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_material_highlight" ADD CONSTRAINT "_categories_v_blocks_material_highlight_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_cta" ADD CONSTRAINT "_categories_v_blocks_cta_destination_id_categories_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_cta" ADD CONSTRAINT "_categories_v_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_gallery_items" ADD CONSTRAINT "_categories_v_blocks_gallery_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_gallery_items" ADD CONSTRAINT "_categories_v_blocks_gallery_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_gallery" ADD CONSTRAINT "_categories_v_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_blocks_divider" ADD CONSTRAINT "_categories_v_blocks_divider_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_version_menu_highlights" ADD CONSTRAINT "_categories_v_version_menu_highlights_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_version_menu_highlights" ADD CONSTRAINT "_categories_v_version_menu_highlights_destination_id_categories_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_version_menu_highlights" ADD CONSTRAINT "_categories_v_version_menu_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_roots" ADD CONSTRAINT "navigation_roots_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navigation_roots" ADD CONSTRAINT "navigation_roots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_navigation_v_version_roots" ADD CONSTRAINT "_navigation_v_version_roots_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_navigation_v_version_roots" ADD CONSTRAINT "_navigation_v_version_roots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_navigation_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "categories_listing_rules_availability_order_idx" ON "categories_listing_rules_availability" USING btree ("order");
  CREATE INDEX "categories_listing_rules_availability_parent_idx" ON "categories_listing_rules_availability" USING btree ("parent_id");
  CREATE INDEX "categories_listing_rules_materials_order_idx" ON "categories_listing_rules_materials" USING btree ("_order");
  CREATE INDEX "categories_listing_rules_materials_parent_id_idx" ON "categories_listing_rules_materials" USING btree ("_parent_id");
  CREATE INDEX "categories_listing_rules_product_status_order_idx" ON "categories_listing_rules_product_status" USING btree ("order");
  CREATE INDEX "categories_listing_rules_product_status_parent_idx" ON "categories_listing_rules_product_status" USING btree ("parent_id");
  CREATE INDEX "categories_collection_page_visible_filters_order_idx" ON "categories_collection_page_visible_filters" USING btree ("order");
  CREATE INDEX "categories_collection_page_visible_filters_parent_idx" ON "categories_collection_page_visible_filters" USING btree ("parent_id");
  CREATE INDEX "categories_blocks_rich_text_order_idx" ON "categories_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "categories_blocks_rich_text_parent_id_idx" ON "categories_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "categories_blocks_rich_text_path_idx" ON "categories_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "categories_blocks_image_order_idx" ON "categories_blocks_image" USING btree ("_order");
  CREATE INDEX "categories_blocks_image_parent_id_idx" ON "categories_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "categories_blocks_image_path_idx" ON "categories_blocks_image" USING btree ("_path");
  CREATE INDEX "categories_blocks_image_image_idx" ON "categories_blocks_image" USING btree ("image_id");
  CREATE INDEX "categories_blocks_image_text_order_idx" ON "categories_blocks_image_text" USING btree ("_order");
  CREATE INDEX "categories_blocks_image_text_parent_id_idx" ON "categories_blocks_image_text" USING btree ("_parent_id");
  CREATE INDEX "categories_blocks_image_text_path_idx" ON "categories_blocks_image_text" USING btree ("_path");
  CREATE INDEX "categories_blocks_image_text_image_idx" ON "categories_blocks_image_text" USING btree ("image_id");
  CREATE INDEX "categories_blocks_manifesto_order_idx" ON "categories_blocks_manifesto" USING btree ("_order");
  CREATE INDEX "categories_blocks_manifesto_parent_id_idx" ON "categories_blocks_manifesto" USING btree ("_parent_id");
  CREATE INDEX "categories_blocks_manifesto_path_idx" ON "categories_blocks_manifesto" USING btree ("_path");
  CREATE INDEX "categories_blocks_material_highlight_order_idx" ON "categories_blocks_material_highlight" USING btree ("_order");
  CREATE INDEX "categories_blocks_material_highlight_parent_id_idx" ON "categories_blocks_material_highlight" USING btree ("_parent_id");
  CREATE INDEX "categories_blocks_material_highlight_path_idx" ON "categories_blocks_material_highlight" USING btree ("_path");
  CREATE INDEX "categories_blocks_material_highlight_image_idx" ON "categories_blocks_material_highlight" USING btree ("image_id");
  CREATE INDEX "categories_blocks_cta_order_idx" ON "categories_blocks_cta" USING btree ("_order");
  CREATE INDEX "categories_blocks_cta_parent_id_idx" ON "categories_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "categories_blocks_cta_path_idx" ON "categories_blocks_cta" USING btree ("_path");
  CREATE INDEX "categories_blocks_cta_destination_idx" ON "categories_blocks_cta" USING btree ("destination_id");
  CREATE INDEX "categories_blocks_gallery_items_order_idx" ON "categories_blocks_gallery_items" USING btree ("_order");
  CREATE INDEX "categories_blocks_gallery_items_parent_id_idx" ON "categories_blocks_gallery_items" USING btree ("_parent_id");
  CREATE INDEX "categories_blocks_gallery_items_image_idx" ON "categories_blocks_gallery_items" USING btree ("image_id");
  CREATE INDEX "categories_blocks_gallery_order_idx" ON "categories_blocks_gallery" USING btree ("_order");
  CREATE INDEX "categories_blocks_gallery_parent_id_idx" ON "categories_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "categories_blocks_gallery_path_idx" ON "categories_blocks_gallery" USING btree ("_path");
  CREATE INDEX "categories_blocks_divider_order_idx" ON "categories_blocks_divider" USING btree ("_order");
  CREATE INDEX "categories_blocks_divider_parent_id_idx" ON "categories_blocks_divider" USING btree ("_parent_id");
  CREATE INDEX "categories_blocks_divider_path_idx" ON "categories_blocks_divider" USING btree ("_path");
  CREATE INDEX "categories_menu_highlights_order_idx" ON "categories_menu_highlights" USING btree ("_order");
  CREATE INDEX "categories_menu_highlights_parent_id_idx" ON "categories_menu_highlights" USING btree ("_parent_id");
  CREATE INDEX "categories_menu_highlights_image_idx" ON "categories_menu_highlights" USING btree ("image_id");
  CREATE INDEX "categories_menu_highlights_destination_idx" ON "categories_menu_highlights" USING btree ("destination_id");
  CREATE INDEX "_categories_v_version_listing_rules_availability_order_idx" ON "_categories_v_version_listing_rules_availability" USING btree ("order");
  CREATE INDEX "_categories_v_version_listing_rules_availability_parent_idx" ON "_categories_v_version_listing_rules_availability" USING btree ("parent_id");
  CREATE INDEX "_categories_v_version_listing_rules_materials_order_idx" ON "_categories_v_version_listing_rules_materials" USING btree ("_order");
  CREATE INDEX "_categories_v_version_listing_rules_materials_parent_id_idx" ON "_categories_v_version_listing_rules_materials" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_version_listing_rules_product_status_order_idx" ON "_categories_v_version_listing_rules_product_status" USING btree ("order");
  CREATE INDEX "_categories_v_version_listing_rules_product_status_parent_idx" ON "_categories_v_version_listing_rules_product_status" USING btree ("parent_id");
  CREATE INDEX "_categories_v_version_collection_page_visible_filters_order_idx" ON "_categories_v_version_collection_page_visible_filters" USING btree ("order");
  CREATE INDEX "_categories_v_version_collection_page_visible_filters_parent_idx" ON "_categories_v_version_collection_page_visible_filters" USING btree ("parent_id");
  CREATE INDEX "_categories_v_blocks_rich_text_order_idx" ON "_categories_v_blocks_rich_text" USING btree ("_order");
  CREATE INDEX "_categories_v_blocks_rich_text_parent_id_idx" ON "_categories_v_blocks_rich_text" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_blocks_rich_text_path_idx" ON "_categories_v_blocks_rich_text" USING btree ("_path");
  CREATE INDEX "_categories_v_blocks_image_order_idx" ON "_categories_v_blocks_image" USING btree ("_order");
  CREATE INDEX "_categories_v_blocks_image_parent_id_idx" ON "_categories_v_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_blocks_image_path_idx" ON "_categories_v_blocks_image" USING btree ("_path");
  CREATE INDEX "_categories_v_blocks_image_image_idx" ON "_categories_v_blocks_image" USING btree ("image_id");
  CREATE INDEX "_categories_v_blocks_image_text_order_idx" ON "_categories_v_blocks_image_text" USING btree ("_order");
  CREATE INDEX "_categories_v_blocks_image_text_parent_id_idx" ON "_categories_v_blocks_image_text" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_blocks_image_text_path_idx" ON "_categories_v_blocks_image_text" USING btree ("_path");
  CREATE INDEX "_categories_v_blocks_image_text_image_idx" ON "_categories_v_blocks_image_text" USING btree ("image_id");
  CREATE INDEX "_categories_v_blocks_manifesto_order_idx" ON "_categories_v_blocks_manifesto" USING btree ("_order");
  CREATE INDEX "_categories_v_blocks_manifesto_parent_id_idx" ON "_categories_v_blocks_manifesto" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_blocks_manifesto_path_idx" ON "_categories_v_blocks_manifesto" USING btree ("_path");
  CREATE INDEX "_categories_v_blocks_material_highlight_order_idx" ON "_categories_v_blocks_material_highlight" USING btree ("_order");
  CREATE INDEX "_categories_v_blocks_material_highlight_parent_id_idx" ON "_categories_v_blocks_material_highlight" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_blocks_material_highlight_path_idx" ON "_categories_v_blocks_material_highlight" USING btree ("_path");
  CREATE INDEX "_categories_v_blocks_material_highlight_image_idx" ON "_categories_v_blocks_material_highlight" USING btree ("image_id");
  CREATE INDEX "_categories_v_blocks_cta_order_idx" ON "_categories_v_blocks_cta" USING btree ("_order");
  CREATE INDEX "_categories_v_blocks_cta_parent_id_idx" ON "_categories_v_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_blocks_cta_path_idx" ON "_categories_v_blocks_cta" USING btree ("_path");
  CREATE INDEX "_categories_v_blocks_cta_destination_idx" ON "_categories_v_blocks_cta" USING btree ("destination_id");
  CREATE INDEX "_categories_v_blocks_gallery_items_order_idx" ON "_categories_v_blocks_gallery_items" USING btree ("_order");
  CREATE INDEX "_categories_v_blocks_gallery_items_parent_id_idx" ON "_categories_v_blocks_gallery_items" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_blocks_gallery_items_image_idx" ON "_categories_v_blocks_gallery_items" USING btree ("image_id");
  CREATE INDEX "_categories_v_blocks_gallery_order_idx" ON "_categories_v_blocks_gallery" USING btree ("_order");
  CREATE INDEX "_categories_v_blocks_gallery_parent_id_idx" ON "_categories_v_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_blocks_gallery_path_idx" ON "_categories_v_blocks_gallery" USING btree ("_path");
  CREATE INDEX "_categories_v_blocks_divider_order_idx" ON "_categories_v_blocks_divider" USING btree ("_order");
  CREATE INDEX "_categories_v_blocks_divider_parent_id_idx" ON "_categories_v_blocks_divider" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_blocks_divider_path_idx" ON "_categories_v_blocks_divider" USING btree ("_path");
  CREATE INDEX "_categories_v_version_menu_highlights_order_idx" ON "_categories_v_version_menu_highlights" USING btree ("_order");
  CREATE INDEX "_categories_v_version_menu_highlights_parent_id_idx" ON "_categories_v_version_menu_highlights" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_version_menu_highlights_image_idx" ON "_categories_v_version_menu_highlights" USING btree ("image_id");
  CREATE INDEX "_categories_v_version_menu_highlights_destination_idx" ON "_categories_v_version_menu_highlights" USING btree ("destination_id");
  CREATE INDEX "navigation_roots_order_idx" ON "navigation_roots" USING btree ("_order");
  CREATE INDEX "navigation_roots_parent_id_idx" ON "navigation_roots" USING btree ("_parent_id");
  CREATE INDEX "navigation_roots_category_idx" ON "navigation_roots" USING btree ("category_id");
  CREATE INDEX "_navigation_v_version_roots_order_idx" ON "_navigation_v_version_roots" USING btree ("_order");
  CREATE INDEX "_navigation_v_version_roots_parent_id_idx" ON "_navigation_v_version_roots" USING btree ("_parent_id");
  CREATE INDEX "_navigation_v_version_roots_category_idx" ON "_navigation_v_version_roots" USING btree ("category_id");
  CREATE INDEX "categories_node_type_idx" ON "categories" USING btree ("node_type");
  CREATE INDEX "categories_taxonomy_axis_idx" ON "categories" USING btree ("taxonomy_axis");
  CREATE INDEX "categories_order_idx" ON "categories" USING btree ("order");
  CREATE INDEX "_categories_v_version_version_node_type_idx" ON "_categories_v" USING btree ("version_node_type");
  CREATE INDEX "_categories_v_version_version_taxonomy_axis_idx" ON "_categories_v" USING btree ("version_taxonomy_axis");
  CREATE INDEX "_categories_v_version_version_order_idx" ON "_categories_v" USING btree ("version_order");
  CREATE INDEX "_categories_v_version_version_publication_revision_idx" ON "_categories_v" USING btree ("version_publication_revision");
  CREATE INDEX "_products_v_version_version_publication_revision_idx" ON "_products_v" USING btree ("version_publication_revision");
  CREATE INDEX "_home_v_version_version_publication_revision_idx" ON "_home_v" USING btree ("version_publication_revision");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "categories_listing_rules_availability" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_listing_rules_materials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_listing_rules_product_status" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_collection_page_visible_filters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_blocks_rich_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_blocks_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_blocks_image_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_blocks_manifesto" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_blocks_material_highlight" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_blocks_cta" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_blocks_gallery_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_blocks_divider" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_menu_highlights" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_version_listing_rules_availability" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_version_listing_rules_materials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_version_listing_rules_product_status" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_version_collection_page_visible_filters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_blocks_rich_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_blocks_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_blocks_image_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_blocks_manifesto" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_blocks_material_highlight" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_blocks_cta" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_blocks_gallery_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_blocks_divider" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_categories_v_version_menu_highlights" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "navigation_roots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_navigation_v_version_roots" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "categories_listing_rules_availability" CASCADE;
  DROP TABLE "categories_listing_rules_materials" CASCADE;
  DROP TABLE "categories_listing_rules_product_status" CASCADE;
  DROP TABLE "categories_collection_page_visible_filters" CASCADE;
  DROP TABLE "categories_blocks_rich_text" CASCADE;
  DROP TABLE "categories_blocks_image" CASCADE;
  DROP TABLE "categories_blocks_image_text" CASCADE;
  DROP TABLE "categories_blocks_manifesto" CASCADE;
  DROP TABLE "categories_blocks_material_highlight" CASCADE;
  DROP TABLE "categories_blocks_cta" CASCADE;
  DROP TABLE "categories_blocks_gallery_items" CASCADE;
  DROP TABLE "categories_blocks_gallery" CASCADE;
  DROP TABLE "categories_blocks_divider" CASCADE;
  DROP TABLE "categories_menu_highlights" CASCADE;
  DROP TABLE "_categories_v_version_listing_rules_availability" CASCADE;
  DROP TABLE "_categories_v_version_listing_rules_materials" CASCADE;
  DROP TABLE "_categories_v_version_listing_rules_product_status" CASCADE;
  DROP TABLE "_categories_v_version_collection_page_visible_filters" CASCADE;
  DROP TABLE "_categories_v_blocks_rich_text" CASCADE;
  DROP TABLE "_categories_v_blocks_image" CASCADE;
  DROP TABLE "_categories_v_blocks_image_text" CASCADE;
  DROP TABLE "_categories_v_blocks_manifesto" CASCADE;
  DROP TABLE "_categories_v_blocks_material_highlight" CASCADE;
  DROP TABLE "_categories_v_blocks_cta" CASCADE;
  DROP TABLE "_categories_v_blocks_gallery_items" CASCADE;
  DROP TABLE "_categories_v_blocks_gallery" CASCADE;
  DROP TABLE "_categories_v_blocks_divider" CASCADE;
  DROP TABLE "_categories_v_version_menu_highlights" CASCADE;
  DROP TABLE "navigation_roots" CASCADE;
  DROP TABLE "_navigation_v_version_roots" CASCADE;
  DROP INDEX "categories_node_type_idx";
  DROP INDEX "categories_taxonomy_axis_idx";
  DROP INDEX "categories_order_idx";
  DROP INDEX "_categories_v_version_version_node_type_idx";
  DROP INDEX "_categories_v_version_version_taxonomy_axis_idx";
  DROP INDEX "_categories_v_version_version_order_idx";
  DROP INDEX "_categories_v_version_version_publication_revision_idx";
  DROP INDEX "_products_v_version_version_publication_revision_idx";
  DROP INDEX "_home_v_version_version_publication_revision_idx";
  ALTER TABLE "categories" DROP COLUMN "node_type";
  ALTER TABLE "categories" DROP COLUMN "taxonomy_axis";
  ALTER TABLE "categories" DROP COLUMN "menu_show_in_menu";
  ALTER TABLE "categories" DROP COLUMN "menu_label";
  ALTER TABLE "categories" DROP COLUMN "menu_visibility";
  ALTER TABLE "categories" DROP COLUMN "menu_icon";
  ALTER TABLE "categories" DROP COLUMN "listing_mode";
  ALTER TABLE "categories" DROP COLUMN "listing_rules_min_price";
  ALTER TABLE "categories" DROP COLUMN "listing_rules_max_price";
  ALTER TABLE "categories" DROP COLUMN "listing_rules_published_after";
  ALTER TABLE "categories" DROP COLUMN "listing_rules_published_before";
  ALTER TABLE "categories" DROP COLUMN "listing_rules_sort";
  ALTER TABLE "categories" DROP COLUMN "collection_page_eyebrow";
  ALTER TABLE "categories" DROP COLUMN "collection_page_short_description";
  ALTER TABLE "categories" DROP COLUMN "collection_page_default_sort";
  ALTER TABLE "categories" DROP COLUMN "collection_page_products_per_page";
  ALTER TABLE "categories" DROP COLUMN "collection_page_show_product_count";
  ALTER TABLE "categories" DROP COLUMN "collection_page_layout";
  ALTER TABLE "categories" DROP COLUMN "external_u_r_l";
  ALTER TABLE "categories" DROP COLUMN "hub_path";
  ALTER TABLE "_categories_v" DROP COLUMN "version_node_type";
  ALTER TABLE "_categories_v" DROP COLUMN "version_taxonomy_axis";
  ALTER TABLE "_categories_v" DROP COLUMN "version_menu_show_in_menu";
  ALTER TABLE "_categories_v" DROP COLUMN "version_menu_label";
  ALTER TABLE "_categories_v" DROP COLUMN "version_menu_visibility";
  ALTER TABLE "_categories_v" DROP COLUMN "version_menu_icon";
  ALTER TABLE "_categories_v" DROP COLUMN "version_listing_mode";
  ALTER TABLE "_categories_v" DROP COLUMN "version_listing_rules_min_price";
  ALTER TABLE "_categories_v" DROP COLUMN "version_listing_rules_max_price";
  ALTER TABLE "_categories_v" DROP COLUMN "version_listing_rules_published_after";
  ALTER TABLE "_categories_v" DROP COLUMN "version_listing_rules_published_before";
  ALTER TABLE "_categories_v" DROP COLUMN "version_listing_rules_sort";
  ALTER TABLE "_categories_v" DROP COLUMN "version_collection_page_eyebrow";
  ALTER TABLE "_categories_v" DROP COLUMN "version_collection_page_short_description";
  ALTER TABLE "_categories_v" DROP COLUMN "version_collection_page_default_sort";
  ALTER TABLE "_categories_v" DROP COLUMN "version_collection_page_products_per_page";
  ALTER TABLE "_categories_v" DROP COLUMN "version_collection_page_show_product_count";
  ALTER TABLE "_categories_v" DROP COLUMN "version_collection_page_layout";
  ALTER TABLE "_categories_v" DROP COLUMN "version_external_u_r_l";
  ALTER TABLE "_categories_v" DROP COLUMN "version_hub_path";
  DROP TYPE "public"."enum_categories_listing_rules_availability";
  DROP TYPE "public"."enum_categories_listing_rules_product_status";
  DROP TYPE "public"."enum_categories_collection_page_visible_filters";
  DROP TYPE "public"."enum_categories_blocks_rich_text_placement";
  DROP TYPE "public"."enum_categories_blocks_image_placement";
  DROP TYPE "public"."enum_categories_blocks_image_text_placement";
  DROP TYPE "public"."enum_categories_blocks_image_text_image_position";
  DROP TYPE "public"."enum_categories_blocks_manifesto_placement";
  DROP TYPE "public"."enum_categories_blocks_material_highlight_placement";
  DROP TYPE "public"."enum_categories_blocks_cta_placement";
  DROP TYPE "public"."enum_categories_blocks_gallery_placement";
  DROP TYPE "public"."enum_categories_blocks_divider_placement";
  DROP TYPE "public"."enum_categories_node_type";
  DROP TYPE "public"."enum_categories_taxonomy_axis";
  DROP TYPE "public"."enum_categories_menu_visibility";
  DROP TYPE "public"."enum_categories_listing_mode";
  DROP TYPE "public"."enum_categories_listing_rules_sort";
  DROP TYPE "public"."enum_categories_collection_page_default_sort";
  DROP TYPE "public"."enum_categories_collection_page_layout";
  DROP TYPE "public"."enum__categories_v_version_listing_rules_availability";
  DROP TYPE "public"."enum__categories_v_version_listing_rules_product_status";
  DROP TYPE "public"."enum__categories_v_version_collection_page_visible_filters";
  DROP TYPE "public"."enum__categories_v_blocks_rich_text_placement";
  DROP TYPE "public"."enum__categories_v_blocks_image_placement";
  DROP TYPE "public"."enum__categories_v_blocks_image_text_placement";
  DROP TYPE "public"."enum__categories_v_blocks_image_text_image_position";
  DROP TYPE "public"."enum__categories_v_blocks_manifesto_placement";
  DROP TYPE "public"."enum__categories_v_blocks_material_highlight_placement";
  DROP TYPE "public"."enum__categories_v_blocks_cta_placement";
  DROP TYPE "public"."enum__categories_v_blocks_gallery_placement";
  DROP TYPE "public"."enum__categories_v_blocks_divider_placement";
  DROP TYPE "public"."enum__categories_v_version_node_type";
  DROP TYPE "public"."enum__categories_v_version_taxonomy_axis";
  DROP TYPE "public"."enum__categories_v_version_menu_visibility";
  DROP TYPE "public"."enum__categories_v_version_listing_mode";
  DROP TYPE "public"."enum__categories_v_version_listing_rules_sort";
  DROP TYPE "public"."enum__categories_v_version_collection_page_default_sort";
  DROP TYPE "public"."enum__categories_v_version_collection_page_layout";
  DROP TYPE "public"."enum_navigation_roots_desktop_mode";
  DROP TYPE "public"."enum_navigation_roots_mobile_mode";
  DROP TYPE "public"."enum__navigation_v_version_roots_desktop_mode";
  DROP TYPE "public"."enum__navigation_v_version_roots_mobile_mode";`)
}
