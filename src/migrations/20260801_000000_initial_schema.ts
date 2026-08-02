import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'commercial');
  CREATE TYPE "public"."category_state" AS ENUM('active', 'archive');
  CREATE TYPE "public"."enum_categories_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__categories_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_products_gallery_role" AS ENUM('cover', 'detail', 'context', 'scale');
  CREATE TYPE "public"."enum_products_variants_price_mode" AS ENUM('inherit', 'fixed', 'inquiry');
  CREATE TYPE "public"."enum_products_variants_status" AS ENUM('enabled', 'disabled');
  CREATE TYPE "public"."enum_products_catalog_status" AS ENUM('active', 'archived');
  CREATE TYPE "public"."enum_products_availability" AS ENUM('unique', 'available', 'made_to_order', 'limited');
  CREATE TYPE "public"."enum_products_price_mode" AS ENUM('fixed', 'inquiry');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__products_v_version_gallery_role" AS ENUM('cover', 'detail', 'context', 'scale');
  CREATE TYPE "public"."enum__products_v_version_variants_price_mode" AS ENUM('inherit', 'fixed', 'inquiry');
  CREATE TYPE "public"."enum__products_v_version_variants_status" AS ENUM('enabled', 'disabled');
  CREATE TYPE "public"."enum__products_v_version_catalog_status" AS ENUM('active', 'archived');
  CREATE TYPE "public"."enum__products_v_version_availability" AS ENUM('unique', 'available', 'made_to_order', 'limited');
  CREATE TYPE "public"."enum__products_v_version_price_mode" AS ENUM('fixed', 'inquiry');
  CREATE TYPE "public"."enum__products_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_leads_source" AS ENUM('instagram', 'referral', 'site', 'architect', 'organic', 'whatsapp', 'other');
  CREATE TYPE "public"."enum_leads_stage" AS ENUM('new', 'curation', 'proposal', 'negotiation', 'won', 'lost');
  CREATE TYPE "public"."enum__leads_v_version_source" AS ENUM('instagram', 'referral', 'site', 'architect', 'organic', 'whatsapp', 'other');
  CREATE TYPE "public"."enum__leads_v_version_stage" AS ENUM('new', 'curation', 'proposal', 'negotiation', 'won', 'lost');
  CREATE TYPE "public"."enum_customers_status" AS ENUM('active', 'follow_up', 'inactive', 'archived');
  CREATE TYPE "public"."enum_customers_origin" AS ENUM('instagram', 'referral', 'site', 'architect', 'organic', 'whatsapp', 'other');
  CREATE TYPE "public"."enum_customers_privacy_request_status" AS ENUM('none', 'requested', 'reviewing', 'blocked', 'completed');
  CREATE TYPE "public"."enum__customers_v_version_status" AS ENUM('active', 'follow_up', 'inactive', 'archived');
  CREATE TYPE "public"."enum__customers_v_version_origin" AS ENUM('instagram', 'referral', 'site', 'architect', 'organic', 'whatsapp', 'other');
  CREATE TYPE "public"."enum__customers_v_version_privacy_request_status" AS ENUM('none', 'requested', 'reviewing', 'blocked', 'completed');
  CREATE TYPE "public"."enum_client_interests_status" AS ENUM('active', 'curation', 'purchased', 'paused', 'archived');
  CREATE TYPE "public"."enum_client_interests_source" AS ENUM('manual', 'lead', 'sale', 'after_sale');
  CREATE TYPE "public"."enum__client_interests_v_version_status" AS ENUM('active', 'curation', 'purchased', 'paused', 'archived');
  CREATE TYPE "public"."enum__client_interests_v_version_source" AS ENUM('manual', 'lead', 'sale', 'after_sale');
  CREATE TYPE "public"."enum_opportunities_source" AS ENUM('instagram', 'referral', 'site', 'architect', 'organic', 'whatsapp', 'other');
  CREATE TYPE "public"."enum_opportunities_stage" AS ENUM('new', 'curation', 'proposal', 'negotiation', 'won', 'lost');
  CREATE TYPE "public"."enum_opportunities_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_opportunities_loss_reason" AS ENUM('price', 'budget', 'timing', 'no_response', 'product_fit', 'competitor', 'changed_mind', 'other');
  CREATE TYPE "public"."enum__opportunities_v_version_source" AS ENUM('instagram', 'referral', 'site', 'architect', 'organic', 'whatsapp', 'other');
  CREATE TYPE "public"."enum__opportunities_v_version_stage" AS ENUM('new', 'curation', 'proposal', 'negotiation', 'won', 'lost');
  CREATE TYPE "public"."enum__opportunities_v_version_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum__opportunities_v_version_loss_reason" AS ENUM('price', 'budget', 'timing', 'no_response', 'product_fit', 'competitor', 'changed_mind', 'other');
  CREATE TYPE "public"."enum_sales_items_price_mode" AS ENUM('fixed', 'inquiry');
  CREATE TYPE "public"."enum_sales_channel" AS ENUM('whatsapp', 'instagram', 'site', 'referral', 'architect', 'other');
  CREATE TYPE "public"."enum_sales_status" AS ENUM('draft', 'proposal', 'negotiation', 'confirmed', 'production', 'ready', 'delivered', 'cancelled');
  CREATE TYPE "public"."enum_sales_delivery_mode" AS ENUM('carrier', 'pickup', 'own_delivery');
  CREATE TYPE "public"."enum__sales_v_version_items_price_mode" AS ENUM('fixed', 'inquiry');
  CREATE TYPE "public"."enum__sales_v_version_channel" AS ENUM('whatsapp', 'instagram', 'site', 'referral', 'architect', 'other');
  CREATE TYPE "public"."enum__sales_v_version_status" AS ENUM('draft', 'proposal', 'negotiation', 'confirmed', 'production', 'ready', 'delivered', 'cancelled');
  CREATE TYPE "public"."enum__sales_v_version_delivery_mode" AS ENUM('carrier', 'pickup', 'own_delivery');
  CREATE TYPE "public"."enum_after_sales_follow_ups_moment" AS ENUM('d3', 'd15', 'd90', 'custom');
  CREATE TYPE "public"."enum_after_sales_follow_ups_purpose" AS ENUM('receipt', 'satisfaction', 'testimonial', 'maintenance', 'curation', 'other');
  CREATE TYPE "public"."enum_after_sales_follow_ups_status" AS ENUM('pending', 'done', 'cancelled');
  CREATE TYPE "public"."enum_after_sales_status" AS ENUM('open', 'following', 'resolved', 'closed');
  CREATE TYPE "public"."enum_after_sales_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_after_sales_incident_type" AS ENUM('none', 'damage', 'adjustment', 'maintenance', 'other');
  CREATE TYPE "public"."enum__after_sales_v_version_follow_ups_moment" AS ENUM('d3', 'd15', 'd90', 'custom');
  CREATE TYPE "public"."enum__after_sales_v_version_follow_ups_purpose" AS ENUM('receipt', 'satisfaction', 'testimonial', 'maintenance', 'curation', 'other');
  CREATE TYPE "public"."enum__after_sales_v_version_follow_ups_status" AS ENUM('pending', 'done', 'cancelled');
  CREATE TYPE "public"."enum__after_sales_v_version_status" AS ENUM('open', 'following', 'resolved', 'closed');
  CREATE TYPE "public"."enum__after_sales_v_version_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum__after_sales_v_version_incident_type" AS ENUM('none', 'damage', 'adjustment', 'maintenance', 'other');
  CREATE TYPE "public"."enum_tasks_type" AS ENUM('delivery_confirmation', 'satisfaction', 'testimonial', 'maintenance', 'curation', 'custom');
  CREATE TYPE "public"."enum_tasks_status" AS ENUM('pending', 'in_progress', 'done', 'cancelled');
  CREATE TYPE "public"."enum_tasks_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum__tasks_v_version_type" AS ENUM('delivery_confirmation', 'satisfaction', 'testimonial', 'maintenance', 'curation', 'custom');
  CREATE TYPE "public"."enum__tasks_v_version_status" AS ENUM('pending', 'in_progress', 'done', 'cancelled');
  CREATE TYPE "public"."enum__tasks_v_version_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_shipments_status" AS ENUM('confirmed', 'collected', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'cancelled');
  CREATE TYPE "public"."enum__shipments_v_version_status" AS ENUM('confirmed', 'collected', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'cancelled');
  CREATE TYPE "public"."enum_occurrences_type" AS ENUM('damage', 'adjustment', 'maintenance', 'delivery_delay', 'return', 'other');
  CREATE TYPE "public"."enum_occurrences_severity" AS ENUM('low', 'medium', 'high', 'critical');
  CREATE TYPE "public"."enum_occurrences_status" AS ENUM('open', 'investigating', 'waiting_customer', 'resolved', 'closed');
  CREATE TYPE "public"."enum__occurrences_v_version_type" AS ENUM('damage', 'adjustment', 'maintenance', 'delivery_delay', 'return', 'other');
  CREATE TYPE "public"."enum__occurrences_v_version_severity" AS ENUM('low', 'medium', 'high', 'critical');
  CREATE TYPE "public"."enum__occurrences_v_version_status" AS ENUM('open', 'investigating', 'waiting_customer', 'resolved', 'closed');
  CREATE TYPE "public"."enum_activities_event_type" AS ENUM('opportunity.created', 'opportunity.migrated', 'sale.created', 'opportunity.stage_changed', 'interest.added', 'task.created', 'task.status_changed', 'followup.completed', 'shipment.status_changed', 'shipment.delivered', 'occurrence.opened', 'occurrence.status_changed', 'occurrence.resolved', 'note.created', 'contact.logged');
  CREATE TYPE "public"."enum_activities_kind" AS ENUM('contact', 'message', 'proposal', 'stage_change', 'sale', 'note', 'delivery', 'follow_up', 'occurrence');
  CREATE TYPE "public"."enum_activities_from_stage" AS ENUM('new', 'curation', 'proposal', 'negotiation', 'won', 'lost');
  CREATE TYPE "public"."enum_activities_to_stage" AS ENUM('new', 'curation', 'proposal', 'negotiation', 'won', 'lost');
  CREATE TYPE "public"."enum_activities_loss_reason" AS ENUM('price', 'budget', 'timing', 'no_response', 'product_fit', 'competitor', 'changed_mind', 'other');
  CREATE TYPE "public"."enum_report_exports_status" AS ENUM('queued', 'processing', 'ready', 'failed');
  CREATE TYPE "public"."enum_report_exports_delivery" AS ENUM('sync', 'job');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'createAfterSalesTask', 'syncActiveShipments', 'generateReportExport');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'createAfterSalesTask', 'syncActiveShipments', 'generateReportExport');
  CREATE TYPE "public"."dest_type" AS ENUM('internal', 'external', 'whatsapp');
  CREATE TYPE "public"."enum_home_hero_mode" AS ENUM('single', 'carousel');
  CREATE TYPE "public"."enum_home_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__home_v_version_hero_mode" AS ENUM('single', 'carousel');
  CREATE TYPE "public"."enum__home_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_about_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__about_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_contact_channels_kind" AS ENUM('instagram', 'email', 'phone', 'whatsapp', 'website', 'other');
  CREATE TYPE "public"."enum_contact_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__contact_v_version_channels_kind" AS ENUM('instagram', 'email', 'phone', 'whatsapp', 'website', 'other');
  CREATE TYPE "public"."enum__contact_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_collection_page_visible_filters" AS ENUM('category', 'material', 'availability', 'price');
  CREATE TYPE "public"."enum_collection_page_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__collection_page_v_version_visible_filters" AS ENUM('category', 'material', 'availability', 'price');
  CREATE TYPE "public"."enum__collection_page_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_navigation_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__navigation_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_site_settings_official_channels_kind" AS ENUM('instagram', 'email', 'phone', 'whatsapp', 'website', 'other');
  CREATE TYPE "public"."enum__site_settings_v_version_official_channels_kind" AS ENUM('instagram', 'email', 'phone', 'whatsapp', 'website', 'other');
  CREATE TYPE "public"."enum_after_sales_automation_maintenance_scope" AS ENUM('selected', 'all');
  CREATE TYPE "public"."enum__after_sales_automation_v_version_maintenance_scope" AS ENUM('selected', 'all');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum_users_role" DEFAULT 'editor' NOT NULL,
  	"name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"credit" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_wide_url" varchar,
  	"sizes_wide_width" numeric,
  	"sizes_wide_height" numeric,
  	"sizes_wide_mime_type" varchar,
  	"sizes_wide_filesize" numeric,
  	"sizes_wide_filename" varchar
  );
  
  CREATE TABLE "report_export_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"semantic_version" varchar NOT NULL,
  	"generated_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "categories_search_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"status" "category_state" DEFAULT 'active',
  	"parent_id" integer,
  	"description" varchar,
  	"image_id" integer,
  	"order" numeric DEFAULT 100,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_social_image_id" integer,
  	"seo_no_index" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_categories_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_categories_v_version_search_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_categories_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_status" "category_state" DEFAULT 'active',
  	"version_parent_id" integer,
  	"version_description" varchar,
  	"version_image_id" integer,
  	"version_order" numeric DEFAULT 100,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_social_image_id" integer,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__categories_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "products_attributes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "products_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"media_key" varchar,
  	"role" "enum_products_gallery_role",
  	"alt" varchar
  );
  
  CREATE TABLE "products_option_definitions_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar,
  	"swatch" varchar
  );
  
  CREATE TABLE "products_option_definitions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "products_variants_selection" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"option" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "products_variants_media_keys" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar
  );
  
  CREATE TABLE "products_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku" varchar,
  	"price_mode" "enum_products_variants_price_mode" DEFAULT 'inherit',
  	"price_cents" numeric,
  	"status" "enum_products_variants_status" DEFAULT 'enabled'
  );
  
  CREATE TABLE "products_search_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar
  );
  
  CREATE TABLE "products_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "products_publication_issues" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"message" varchar
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"slug" varchar,
  	"code" varchar,
  	"catalog_status" "enum_products_catalog_status" DEFAULT 'active',
  	"material" varchar,
  	"description" jsonb,
  	"edition" varchar,
  	"availability" "enum_products_availability" DEFAULT 'available',
  	"price_mode" "enum_products_price_mode" DEFAULT 'inquiry',
  	"base_price_cents" numeric,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_social_image_id" integer,
  	"seo_no_index" boolean DEFAULT false,
  	"publication_ready" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "enum_products_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "_products_v_version_attributes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"media_key" varchar,
  	"role" "enum__products_v_version_gallery_role",
  	"alt" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_option_definitions_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar,
  	"swatch" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_option_definitions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_variants_selection" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"option" varchar,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_variants_media_keys" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"sku" varchar,
  	"price_mode" "enum__products_v_version_variants_price_mode" DEFAULT 'inherit',
  	"price_cents" numeric,
  	"status" "enum__products_v_version_variants_status" DEFAULT 'enabled',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_search_terms" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tag" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_publication_issues" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"message" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_subtitle" varchar,
  	"version_slug" varchar,
  	"version_code" varchar,
  	"version_catalog_status" "enum__products_v_version_catalog_status" DEFAULT 'active',
  	"version_material" varchar,
  	"version_description" jsonb,
  	"version_edition" varchar,
  	"version_availability" "enum__products_v_version_availability" DEFAULT 'available',
  	"version_price_mode" "enum__products_v_version_price_mode" DEFAULT 'inquiry',
  	"version_base_price_cents" numeric,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_social_image_id" integer,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_publication_ready" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "enum__products_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_products_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "leads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar,
  	"email" varchar,
  	"source" "enum_leads_source" NOT NULL,
  	"owner_id" integer,
  	"notes" varchar,
  	"customer_id" integer,
  	"opportunity_id" integer,
  	"opportunity_migrated_at" timestamp(3) with time zone,
  	"marketing_consent" boolean DEFAULT false,
  	"consent_recorded_at" timestamp(3) with time zone,
  	"stage" "enum_leads_stage",
  	"next_action" varchar,
  	"next_action_at" timestamp(3) with time zone,
  	"closed_at" timestamp(3) with time zone,
  	"loss_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "leads_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "_leads_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar NOT NULL,
  	"version_phone" varchar,
  	"version_email" varchar,
  	"version_source" "enum__leads_v_version_source" NOT NULL,
  	"version_owner_id" integer,
  	"version_notes" varchar,
  	"version_customer_id" integer,
  	"version_opportunity_id" integer,
  	"version_opportunity_migrated_at" timestamp(3) with time zone,
  	"version_marketing_consent" boolean DEFAULT false,
  	"version_consent_recorded_at" timestamp(3) with time zone,
  	"version_stage" "enum__leads_v_version_stage",
  	"version_next_action" varchar,
  	"version_next_action_at" timestamp(3) with time zone,
  	"version_closed_at" timestamp(3) with time zone,
  	"version_loss_reason" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_leads_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "customers_interest_profile_materials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "customers_preferences" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "customers_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"company" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"city" varchar,
  	"state" varchar,
  	"normalized_phone" varchar,
  	"normalized_email" varchar,
  	"status" "enum_customers_status" DEFAULT 'active',
  	"origin" "enum_customers_origin",
  	"owner_id" integer,
  	"source_lead_id" integer,
  	"interest_profile_investment_min_cents" numeric,
  	"interest_profile_investment_max_cents" numeric,
  	"relationship_notes" varchar,
  	"merged_into_id" integer,
  	"merged_at" timestamp(3) with time zone,
  	"marketing_consent" boolean DEFAULT false,
  	"consent_recorded_at" timestamp(3) with time zone,
  	"consent_withdrawn_at" timestamp(3) with time zone,
  	"privacy_request_status" "enum_customers_privacy_request_status" DEFAULT 'none',
  	"privacy_request_at" timestamp(3) with time zone,
  	"privacy_request_completed_at" timestamp(3) with time zone,
  	"retention_review_at" timestamp(3) with time zone,
  	"processing_restricted" boolean DEFAULT false,
  	"data_handling_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "customers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "_customers_v_version_interest_profile_materials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_customers_v_version_preferences" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_customers_v_version_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_customers_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar NOT NULL,
  	"version_company" varchar,
  	"version_phone" varchar,
  	"version_email" varchar,
  	"version_city" varchar,
  	"version_state" varchar,
  	"version_normalized_phone" varchar,
  	"version_normalized_email" varchar,
  	"version_status" "enum__customers_v_version_status" DEFAULT 'active',
  	"version_origin" "enum__customers_v_version_origin",
  	"version_owner_id" integer,
  	"version_source_lead_id" integer,
  	"version_interest_profile_investment_min_cents" numeric,
  	"version_interest_profile_investment_max_cents" numeric,
  	"version_relationship_notes" varchar,
  	"version_merged_into_id" integer,
  	"version_merged_at" timestamp(3) with time zone,
  	"version_marketing_consent" boolean DEFAULT false,
  	"version_consent_recorded_at" timestamp(3) with time zone,
  	"version_consent_withdrawn_at" timestamp(3) with time zone,
  	"version_privacy_request_status" "enum__customers_v_version_privacy_request_status" DEFAULT 'none',
  	"version_privacy_request_at" timestamp(3) with time zone,
  	"version_privacy_request_completed_at" timestamp(3) with time zone,
  	"version_retention_review_at" timestamp(3) with time zone,
  	"version_processing_restricted" boolean DEFAULT false,
  	"version_data_handling_notes" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_customers_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "client_interests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"customer_id" integer NOT NULL,
  	"product_id" integer NOT NULL,
  	"status" "enum_client_interests_status" DEFAULT 'active' NOT NULL,
  	"source" "enum_client_interests_source" DEFAULT 'manual' NOT NULL,
  	"owner_id" integer,
  	"notes" varchar,
  	"added_at" timestamp(3) with time zone NOT NULL,
  	"closed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_client_interests_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_customer_id" integer NOT NULL,
  	"version_product_id" integer NOT NULL,
  	"version_status" "enum__client_interests_v_version_status" DEFAULT 'active' NOT NULL,
  	"version_source" "enum__client_interests_v_version_source" DEFAULT 'manual' NOT NULL,
  	"version_owner_id" integer,
  	"version_notes" varchar,
  	"version_added_at" timestamp(3) with time zone NOT NULL,
  	"version_closed_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opportunities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"customer_id" integer,
  	"source" "enum_opportunities_source" DEFAULT 'other' NOT NULL,
  	"stage" "enum_opportunities_stage" DEFAULT 'new' NOT NULL,
  	"rank" numeric NOT NULL,
  	"owner_id" integer,
  	"priority" "enum_opportunities_priority" DEFAULT 'normal',
  	"estimated_value_cents" numeric,
  	"next_action" varchar,
  	"next_action_at" timestamp(3) with time zone,
  	"expected_close_at" timestamp(3) with time zone,
  	"closed_at" timestamp(3) with time zone,
  	"loss_reason" "enum_opportunities_loss_reason",
  	"loss_notes" varchar,
  	"won_sale_id" integer,
  	"source_lead_id" integer,
  	"migration_version" varchar,
  	"migrated_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "opportunities_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "_opportunities_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_code" varchar NOT NULL,
  	"version_customer_id" integer,
  	"version_source" "enum__opportunities_v_version_source" DEFAULT 'other' NOT NULL,
  	"version_stage" "enum__opportunities_v_version_stage" DEFAULT 'new' NOT NULL,
  	"version_rank" numeric NOT NULL,
  	"version_owner_id" integer,
  	"version_priority" "enum__opportunities_v_version_priority" DEFAULT 'normal',
  	"version_estimated_value_cents" numeric,
  	"version_next_action" varchar,
  	"version_next_action_at" timestamp(3) with time zone,
  	"version_expected_close_at" timestamp(3) with time zone,
  	"version_closed_at" timestamp(3) with time zone,
  	"version_loss_reason" "enum__opportunities_v_version_loss_reason",
  	"version_loss_notes" varchar,
  	"version_won_sale_id" integer,
  	"version_source_lead_id" integer,
  	"version_migration_version" varchar,
  	"version_migrated_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_opportunities_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "sales_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"variant_sku" varchar,
  	"snapshot_title" varchar NOT NULL,
  	"snapshot_slug" varchar NOT NULL,
  	"snapshot_sku" varchar,
  	"snapshot_selection" varchar,
  	"price_mode" "enum_sales_items_price_mode" NOT NULL,
  	"unit_price_cents" numeric,
  	"quantity" numeric DEFAULT 1 NOT NULL
  );
  
  CREATE TABLE "sales" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar NOT NULL,
  	"customer_id" integer NOT NULL,
  	"opportunity_id" integer,
  	"channel" "enum_sales_channel" DEFAULT 'whatsapp' NOT NULL,
  	"status" "enum_sales_status" DEFAULT 'draft' NOT NULL,
  	"owner_id" integer,
  	"confirmed_at" timestamp(3) with time zone,
  	"next_action" varchar,
  	"next_action_at" timestamp(3) with time zone,
  	"discount_cents" numeric DEFAULT 0,
  	"shipping_cents" numeric DEFAULT 0,
  	"subtotal_cents" numeric,
  	"total_cents" numeric,
  	"expected_delivery_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"delivery_mode" "enum_sales_delivery_mode",
  	"delivery_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_sales_v_version_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"variant_sku" varchar,
  	"snapshot_title" varchar NOT NULL,
  	"snapshot_slug" varchar NOT NULL,
  	"snapshot_sku" varchar,
  	"snapshot_selection" varchar,
  	"price_mode" "enum__sales_v_version_items_price_mode" NOT NULL,
  	"unit_price_cents" numeric,
  	"quantity" numeric DEFAULT 1 NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_sales_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_number" varchar NOT NULL,
  	"version_customer_id" integer NOT NULL,
  	"version_opportunity_id" integer,
  	"version_channel" "enum__sales_v_version_channel" DEFAULT 'whatsapp' NOT NULL,
  	"version_status" "enum__sales_v_version_status" DEFAULT 'draft' NOT NULL,
  	"version_owner_id" integer,
  	"version_confirmed_at" timestamp(3) with time zone,
  	"version_next_action" varchar,
  	"version_next_action_at" timestamp(3) with time zone,
  	"version_discount_cents" numeric DEFAULT 0,
  	"version_shipping_cents" numeric DEFAULT 0,
  	"version_subtotal_cents" numeric,
  	"version_total_cents" numeric,
  	"version_expected_delivery_at" timestamp(3) with time zone,
  	"version_delivered_at" timestamp(3) with time zone,
  	"version_delivery_mode" "enum__sales_v_version_delivery_mode",
  	"version_delivery_notes" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "after_sales_follow_ups" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"moment" "enum_after_sales_follow_ups_moment" NOT NULL,
  	"due_at" timestamp(3) with time zone NOT NULL,
  	"purpose" "enum_after_sales_follow_ups_purpose" NOT NULL,
  	"status" "enum_after_sales_follow_ups_status" DEFAULT 'pending' NOT NULL,
  	"notes" varchar,
  	"completed_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "after_sales" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"case_number" varchar,
  	"sale_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"summary" varchar,
  	"status" "enum_after_sales_status" DEFAULT 'open' NOT NULL,
  	"priority" "enum_after_sales_priority" DEFAULT 'normal' NOT NULL,
  	"owner_id" integer,
  	"opened_at" timestamp(3) with time zone,
  	"closed_at" timestamp(3) with time zone,
  	"expected_delivery_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"delivery_notes" varchar,
  	"incident_type" "enum_after_sales_incident_type" DEFAULT 'none',
  	"incident_details" varchar,
  	"resolution" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_after_sales_v_version_follow_ups" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"moment" "enum__after_sales_v_version_follow_ups_moment" NOT NULL,
  	"due_at" timestamp(3) with time zone NOT NULL,
  	"purpose" "enum__after_sales_v_version_follow_ups_purpose" NOT NULL,
  	"status" "enum__after_sales_v_version_follow_ups_status" DEFAULT 'pending' NOT NULL,
  	"notes" varchar,
  	"completed_at" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_after_sales_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_case_number" varchar,
  	"version_sale_id" integer NOT NULL,
  	"version_customer_id" integer NOT NULL,
  	"version_summary" varchar,
  	"version_status" "enum__after_sales_v_version_status" DEFAULT 'open' NOT NULL,
  	"version_priority" "enum__after_sales_v_version_priority" DEFAULT 'normal' NOT NULL,
  	"version_owner_id" integer,
  	"version_opened_at" timestamp(3) with time zone,
  	"version_closed_at" timestamp(3) with time zone,
  	"version_expected_delivery_at" timestamp(3) with time zone,
  	"version_delivered_at" timestamp(3) with time zone,
  	"version_delivery_notes" varchar,
  	"version_incident_type" "enum__after_sales_v_version_incident_type" DEFAULT 'none',
  	"version_incident_details" varchar,
  	"version_resolution" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tasks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"type" "enum_tasks_type" DEFAULT 'custom',
  	"status" "enum_tasks_status" DEFAULT 'pending' NOT NULL,
  	"priority" "enum_tasks_priority" DEFAULT 'normal' NOT NULL,
  	"due_at" timestamp(3) with time zone NOT NULL,
  	"assignee_id" integer,
  	"notes" varchar,
  	"completed_at" timestamp(3) with time zone,
  	"automation_key" varchar,
  	"legacy_source_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "tasks_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"leads_id" integer,
  	"customers_id" integer,
  	"opportunities_id" integer,
  	"sales_id" integer,
  	"after_sales_id" integer,
  	"shipments_id" integer,
  	"occurrences_id" integer
  );
  
  CREATE TABLE "_tasks_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar NOT NULL,
  	"version_type" "enum__tasks_v_version_type" DEFAULT 'custom',
  	"version_status" "enum__tasks_v_version_status" DEFAULT 'pending' NOT NULL,
  	"version_priority" "enum__tasks_v_version_priority" DEFAULT 'normal' NOT NULL,
  	"version_due_at" timestamp(3) with time zone NOT NULL,
  	"version_assignee_id" integer,
  	"version_notes" varchar,
  	"version_completed_at" timestamp(3) with time zone,
  	"version_automation_key" varchar,
  	"version_legacy_source_key" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_tasks_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"leads_id" integer,
  	"customers_id" integer,
  	"opportunities_id" integer,
  	"sales_id" integer,
  	"after_sales_id" integer,
  	"shipments_id" integer,
  	"occurrences_id" integer
  );
  
  CREATE TABLE "shipments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"after_sales_case_id" integer NOT NULL,
  	"sale_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"carrier" varchar,
  	"tracking_code" varchar,
  	"status" "enum_shipments_status" DEFAULT 'confirmed' NOT NULL,
  	"estimated_delivery" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"last_event" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_shipments_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_after_sales_case_id" integer NOT NULL,
  	"version_sale_id" integer NOT NULL,
  	"version_customer_id" integer NOT NULL,
  	"version_carrier" varchar,
  	"version_tracking_code" varchar,
  	"version_status" "enum__shipments_v_version_status" DEFAULT 'confirmed' NOT NULL,
  	"version_estimated_delivery" timestamp(3) with time zone,
  	"version_delivered_at" timestamp(3) with time zone,
  	"version_last_event" varchar,
  	"version_notes" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "occurrences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"after_sales_case_id" integer NOT NULL,
  	"sale_id" integer NOT NULL,
  	"customer_id" integer NOT NULL,
  	"type" "enum_occurrences_type" NOT NULL,
  	"severity" "enum_occurrences_severity" DEFAULT 'medium' NOT NULL,
  	"status" "enum_occurrences_status" DEFAULT 'open' NOT NULL,
  	"owner_id" integer,
  	"description" varchar NOT NULL,
  	"resolution" varchar,
  	"opened_at" timestamp(3) with time zone NOT NULL,
  	"closed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_occurrences_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_after_sales_case_id" integer NOT NULL,
  	"version_sale_id" integer NOT NULL,
  	"version_customer_id" integer NOT NULL,
  	"version_type" "enum__occurrences_v_version_type" NOT NULL,
  	"version_severity" "enum__occurrences_v_version_severity" DEFAULT 'medium' NOT NULL,
  	"version_status" "enum__occurrences_v_version_status" DEFAULT 'open' NOT NULL,
  	"version_owner_id" integer,
  	"version_description" varchar NOT NULL,
  	"version_resolution" varchar,
  	"version_opened_at" timestamp(3) with time zone NOT NULL,
  	"version_closed_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "activities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_type" "enum_activities_event_type",
  	"kind" "enum_activities_kind" NOT NULL,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"summary" varchar NOT NULL,
  	"details" varchar,
  	"owner_id" integer,
  	"opportunity_id" integer,
  	"from_stage" "enum_activities_from_stage",
  	"to_stage" "enum_activities_to_stage",
  	"loss_reason" "enum_activities_loss_reason",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "activities_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"leads_id" integer,
  	"customers_id" integer,
  	"opportunities_id" integer,
  	"sales_id" integer,
  	"after_sales_id" integer,
  	"tasks_id" integer,
  	"shipments_id" integer,
  	"occurrences_id" integer,
  	"client_interests_id" integer
  );
  
  CREATE TABLE "report_exports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"status" "enum_report_exports_status" NOT NULL,
  	"delivery" "enum_report_exports_delivery" NOT NULL,
  	"requested_at" timestamp(3) with time zone NOT NULL,
  	"started_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"requested_by_id" integer NOT NULL,
  	"requested_by_name" varchar NOT NULL,
  	"requested_by_email" varchar,
  	"filename" varchar NOT NULL,
  	"semantic_version" varchar NOT NULL,
  	"snapshot_generated_at" timestamp(3) with time zone,
  	"filters" jsonb NOT NULL,
  	"estimated_rows" numeric,
  	"file_size_bytes" numeric,
  	"file_id" integer,
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"concurrency_key" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"report_export_files_id" integer,
  	"categories_id" integer,
  	"products_id" integer,
  	"leads_id" integer,
  	"customers_id" integer,
  	"client_interests_id" integer,
  	"opportunities_id" integer,
  	"sales_id" integer,
  	"after_sales_id" integer,
  	"tasks_id" integer,
  	"shipments_id" integer,
  	"occurrences_id" integer,
  	"activities_id" integer,
  	"report_exports_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "home_hero_slides" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"desktop_image_image_id" integer,
  	"desktop_image_alt" varchar,
  	"desktop_image_caption" varchar,
  	"mobile_image_image_id" integer,
  	"mobile_image_alt" varchar,
  	"mobile_image_caption" varchar,
  	"statement" varchar,
  	"call_to_action_label" varchar,
  	"call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"call_to_action_path" varchar,
  	"call_to_action_url" varchar,
  	"active" boolean DEFAULT true
  );
  
  CREATE TABLE "home_matter_panels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category_id" integer,
  	"image_image_id" integer,
  	"image_alt" varchar,
  	"image_caption" varchar,
  	"eyebrow" varchar,
  	"headline" varchar,
  	"copy" varchar,
  	"call_to_action_label" varchar,
  	"call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"call_to_action_path" varchar,
  	"call_to_action_url" varchar
  );
  
  CREATE TABLE "home_signature_slides" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"eyebrow" varchar,
  	"headline" varchar,
  	"copy" varchar
  );
  
  CREATE TABLE "home_provenance_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"copy" varchar
  );
  
  CREATE TABLE "home" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_mode" "enum_home_hero_mode" DEFAULT 'single',
  	"autoplay" boolean DEFAULT false,
  	"autoplay_seconds" numeric,
  	"manifesto_eyebrow" varchar,
  	"manifesto_title" varchar,
  	"manifesto_copy" jsonb,
  	"manifesto_primary_image_image_id" integer,
  	"manifesto_primary_image_alt" varchar,
  	"manifesto_primary_image_caption" varchar,
  	"manifesto_secondary_image_image_id" integer,
  	"manifesto_secondary_image_alt" varchar,
  	"manifesto_secondary_image_caption" varchar,
  	"provenance_title" varchar,
  	"provenance_copy" jsonb,
  	"provenance_image_image_id" integer,
  	"provenance_image_alt" varchar,
  	"provenance_image_caption" varchar,
  	"provenance_call_to_action_label" varchar,
  	"provenance_call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"provenance_call_to_action_path" varchar,
  	"provenance_call_to_action_url" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_social_image_id" integer,
  	"seo_no_index" boolean DEFAULT false,
  	"_status" "enum_home_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "home_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "_home_v_version_hero_slides" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"desktop_image_image_id" integer,
  	"desktop_image_alt" varchar,
  	"desktop_image_caption" varchar,
  	"mobile_image_image_id" integer,
  	"mobile_image_alt" varchar,
  	"mobile_image_caption" varchar,
  	"statement" varchar,
  	"call_to_action_label" varchar,
  	"call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"call_to_action_path" varchar,
  	"call_to_action_url" varchar,
  	"active" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_matter_panels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"category_id" integer,
  	"image_image_id" integer,
  	"image_alt" varchar,
  	"image_caption" varchar,
  	"eyebrow" varchar,
  	"headline" varchar,
  	"copy" varchar,
  	"call_to_action_label" varchar,
  	"call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"call_to_action_path" varchar,
  	"call_to_action_url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_signature_slides" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"eyebrow" varchar,
  	"headline" varchar,
  	"copy" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v_version_provenance_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"copy" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_home_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_hero_mode" "enum__home_v_version_hero_mode" DEFAULT 'single',
  	"version_autoplay" boolean DEFAULT false,
  	"version_autoplay_seconds" numeric,
  	"version_manifesto_eyebrow" varchar,
  	"version_manifesto_title" varchar,
  	"version_manifesto_copy" jsonb,
  	"version_manifesto_primary_image_image_id" integer,
  	"version_manifesto_primary_image_alt" varchar,
  	"version_manifesto_primary_image_caption" varchar,
  	"version_manifesto_secondary_image_image_id" integer,
  	"version_manifesto_secondary_image_alt" varchar,
  	"version_manifesto_secondary_image_caption" varchar,
  	"version_provenance_title" varchar,
  	"version_provenance_copy" jsonb,
  	"version_provenance_image_image_id" integer,
  	"version_provenance_image_alt" varchar,
  	"version_provenance_image_caption" varchar,
  	"version_provenance_call_to_action_label" varchar,
  	"version_provenance_call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"version_provenance_call_to_action_path" varchar,
  	"version_provenance_call_to_action_url" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_social_image_id" integer,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version__status" "enum__home_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_home_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  CREATE TABLE "about" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"intro" jsonb,
  	"hero_image_image_id" integer,
  	"hero_image_alt" varchar,
  	"hero_image_caption" varchar,
  	"maison_title" varchar,
  	"maison_copy" jsonb,
  	"maison_image_image_id" integer,
  	"maison_image_alt" varchar,
  	"maison_image_caption" varchar,
  	"vision_title" varchar,
  	"vision_copy" jsonb,
  	"vision_image_image_id" integer,
  	"vision_image_alt" varchar,
  	"vision_image_caption" varchar,
  	"provenance_title" varchar,
  	"provenance_copy" jsonb,
  	"provenance_image_image_id" integer,
  	"provenance_image_alt" varchar,
  	"provenance_image_caption" varchar,
  	"call_to_action_label" varchar,
  	"call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"call_to_action_path" varchar,
  	"call_to_action_url" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_social_image_id" integer,
  	"seo_no_index" boolean DEFAULT false,
  	"_status" "enum_about_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_about_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_title" varchar,
  	"version_intro" jsonb,
  	"version_hero_image_image_id" integer,
  	"version_hero_image_alt" varchar,
  	"version_hero_image_caption" varchar,
  	"version_maison_title" varchar,
  	"version_maison_copy" jsonb,
  	"version_maison_image_image_id" integer,
  	"version_maison_image_alt" varchar,
  	"version_maison_image_caption" varchar,
  	"version_vision_title" varchar,
  	"version_vision_copy" jsonb,
  	"version_vision_image_image_id" integer,
  	"version_vision_image_alt" varchar,
  	"version_vision_image_caption" varchar,
  	"version_provenance_title" varchar,
  	"version_provenance_copy" jsonb,
  	"version_provenance_image_image_id" integer,
  	"version_provenance_image_alt" varchar,
  	"version_provenance_image_caption" varchar,
  	"version_call_to_action_label" varchar,
  	"version_call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"version_call_to_action_path" varchar,
  	"version_call_to_action_url" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_social_image_id" integer,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version__status" "enum__about_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "contact_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"kind" "enum_contact_channels_kind",
  	"value" varchar,
  	"url" varchar,
  	"active" boolean DEFAULT true
  );
  
  CREATE TABLE "contact" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"intro" jsonb,
  	"use_official_channels" boolean DEFAULT true,
  	"service_hours" varchar,
  	"call_to_action_label" varchar,
  	"call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"call_to_action_path" varchar,
  	"call_to_action_url" varchar,
  	"image_image_id" integer,
  	"image_alt" varchar,
  	"image_caption" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_social_image_id" integer,
  	"seo_no_index" boolean DEFAULT false,
  	"_status" "enum_contact_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_contact_v_version_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"kind" "enum__contact_v_version_channels_kind",
  	"value" varchar,
  	"url" varchar,
  	"active" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_contact_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_title" varchar,
  	"version_intro" jsonb,
  	"version_use_official_channels" boolean DEFAULT true,
  	"version_service_hours" varchar,
  	"version_call_to_action_label" varchar,
  	"version_call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"version_call_to_action_path" varchar,
  	"version_call_to_action_url" varchar,
  	"version_image_image_id" integer,
  	"version_image_alt" varchar,
  	"version_image_caption" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_social_image_id" integer,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version__status" "enum__contact_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "collection_page_visible_filters" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_collection_page_visible_filters",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "collection_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"intro" jsonb,
  	"all_label" varchar DEFAULT 'Todos',
  	"inquiry_label" varchar DEFAULT 'Sob consulta',
  	"empty_state_title" varchar,
  	"empty_state_copy" varchar,
  	"empty_state_call_to_action_label" varchar,
  	"empty_state_call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"empty_state_call_to_action_path" varchar,
  	"empty_state_call_to_action_url" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_social_image_id" integer,
  	"seo_no_index" boolean DEFAULT false,
  	"_status" "enum_collection_page_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_collection_page_v_version_visible_filters" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__collection_page_v_version_visible_filters",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_collection_page_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_title" varchar,
  	"version_intro" jsonb,
  	"version_all_label" varchar DEFAULT 'Todos',
  	"version_inquiry_label" varchar DEFAULT 'Sob consulta',
  	"version_empty_state_title" varchar,
  	"version_empty_state_copy" varchar,
  	"version_empty_state_call_to_action_label" varchar,
  	"version_empty_state_call_to_action_destination_type" "dest_type" DEFAULT 'internal',
  	"version_empty_state_call_to_action_path" varchar,
  	"version_empty_state_call_to_action_url" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_social_image_id" integer,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version__status" "enum__collection_page_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "navigation_main_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"path" varchar,
  	"active" boolean DEFAULT true
  );
  
  CREATE TABLE "navigation_utility_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"path" varchar,
  	"active" boolean DEFAULT true
  );
  
  CREATE TABLE "navigation" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_status" "enum_navigation_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "navigation_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "_navigation_v_version_main_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"path" varchar,
  	"active" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_navigation_v_version_utility_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"path" varchar,
  	"active" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_navigation_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version__status" "enum__navigation_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_navigation_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "site_settings_official_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"kind" "enum_site_settings_official_channels_kind" NOT NULL,
  	"value" varchar NOT NULL,
  	"url" varchar,
  	"active" boolean DEFAULT true
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_name" varchar DEFAULT 'Esméra',
  	"default_seo_title" varchar,
  	"default_seo_description" varchar,
  	"frontend_u_r_l" varchar,
  	"analytics_configured" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_site_settings_v_version_official_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"kind" "enum__site_settings_v_version_official_channels_kind" NOT NULL,
  	"value" varchar NOT NULL,
  	"url" varchar,
  	"active" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_site_name" varchar DEFAULT 'Esméra',
  	"version_default_seo_title" varchar,
  	"version_default_seo_description" varchar,
  	"version_frontend_u_r_l" varchar,
  	"version_analytics_configured" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "after_sales_automation" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"preparation_enabled" boolean DEFAULT true,
  	"preparation_delay_hours" numeric DEFAULT 0,
  	"satisfaction_enabled" boolean DEFAULT true,
  	"satisfaction_delay_days" numeric DEFAULT 3,
  	"testimonial_enabled" boolean DEFAULT true,
  	"testimonial_delay_days" numeric DEFAULT 15,
  	"maintenance_enabled" boolean DEFAULT false,
  	"maintenance_delay_days" numeric DEFAULT 90,
  	"maintenance_scope" "enum_after_sales_automation_maintenance_scope" DEFAULT 'selected' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "after_sales_automation_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "_after_sales_automation_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_preparation_enabled" boolean DEFAULT true,
  	"version_preparation_delay_hours" numeric DEFAULT 0,
  	"version_satisfaction_enabled" boolean DEFAULT true,
  	"version_satisfaction_delay_days" numeric DEFAULT 3,
  	"version_testimonial_enabled" boolean DEFAULT true,
  	"version_testimonial_delay_days" numeric DEFAULT 15,
  	"version_maintenance_enabled" boolean DEFAULT false,
  	"version_maintenance_delay_days" numeric DEFAULT 90,
  	"version_maintenance_scope" "enum__after_sales_automation_v_version_maintenance_scope" DEFAULT 'selected' NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_after_sales_automation_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"categories_id" integer
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_search_terms" ADD CONSTRAINT "categories_search_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_seo_social_image_id_media_id_fk" FOREIGN KEY ("seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_version_search_terms" ADD CONSTRAINT "_categories_v_version_search_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_parent_id_categories_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_seo_social_image_id_media_id_fk" FOREIGN KEY ("version_seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_attributes" ADD CONSTRAINT "products_attributes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_gallery" ADD CONSTRAINT "products_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_gallery" ADD CONSTRAINT "products_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_option_definitions_values" ADD CONSTRAINT "products_option_definitions_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_option_definitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_option_definitions" ADD CONSTRAINT "products_option_definitions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_variants_selection" ADD CONSTRAINT "products_variants_selection_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_variants_media_keys" ADD CONSTRAINT "products_variants_media_keys_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_variants" ADD CONSTRAINT "products_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_search_terms" ADD CONSTRAINT "products_search_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_tags" ADD CONSTRAINT "products_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_publication_issues" ADD CONSTRAINT "products_publication_issues_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_seo_social_image_id_media_id_fk" FOREIGN KEY ("seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_attributes" ADD CONSTRAINT "_products_v_version_attributes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_gallery" ADD CONSTRAINT "_products_v_version_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_version_gallery" ADD CONSTRAINT "_products_v_version_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_option_definitions_values" ADD CONSTRAINT "_products_v_version_option_definitions_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v_version_option_definitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_option_definitions" ADD CONSTRAINT "_products_v_version_option_definitions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_variants_selection" ADD CONSTRAINT "_products_v_version_variants_selection_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v_version_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_variants_media_keys" ADD CONSTRAINT "_products_v_version_variants_media_keys_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v_version_variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_variants" ADD CONSTRAINT "_products_v_version_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_search_terms" ADD CONSTRAINT "_products_v_version_search_terms_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_tags" ADD CONSTRAINT "_products_v_version_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_publication_issues" ADD CONSTRAINT "_products_v_version_publication_issues_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_parent_id_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_seo_social_image_id_media_id_fk" FOREIGN KEY ("version_seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leads_rels" ADD CONSTRAINT "leads_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "leads_rels" ADD CONSTRAINT "leads_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "leads_rels" ADD CONSTRAINT "leads_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_leads_v" ADD CONSTRAINT "_leads_v_parent_id_leads_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_leads_v" ADD CONSTRAINT "_leads_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_leads_v" ADD CONSTRAINT "_leads_v_version_customer_id_customers_id_fk" FOREIGN KEY ("version_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_leads_v" ADD CONSTRAINT "_leads_v_version_opportunity_id_opportunities_id_fk" FOREIGN KEY ("version_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_leads_v_rels" ADD CONSTRAINT "_leads_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_leads_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_leads_v_rels" ADD CONSTRAINT "_leads_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_leads_v_rels" ADD CONSTRAINT "_leads_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_interest_profile_materials" ADD CONSTRAINT "customers_interest_profile_materials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_preferences" ADD CONSTRAINT "customers_preferences_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_tags" ADD CONSTRAINT "customers_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_source_lead_id_leads_id_fk" FOREIGN KEY ("source_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_merged_into_id_customers_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers_rels" ADD CONSTRAINT "customers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_rels" ADD CONSTRAINT "customers_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_customers_v_version_interest_profile_materials" ADD CONSTRAINT "_customers_v_version_interest_profile_materials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_customers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_customers_v_version_preferences" ADD CONSTRAINT "_customers_v_version_preferences_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_customers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_customers_v_version_tags" ADD CONSTRAINT "_customers_v_version_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_customers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_customers_v" ADD CONSTRAINT "_customers_v_parent_id_customers_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_customers_v" ADD CONSTRAINT "_customers_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_customers_v" ADD CONSTRAINT "_customers_v_version_source_lead_id_leads_id_fk" FOREIGN KEY ("version_source_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_customers_v" ADD CONSTRAINT "_customers_v_version_merged_into_id_customers_id_fk" FOREIGN KEY ("version_merged_into_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_customers_v_rels" ADD CONSTRAINT "_customers_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_customers_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_customers_v_rels" ADD CONSTRAINT "_customers_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "client_interests" ADD CONSTRAINT "client_interests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_interests" ADD CONSTRAINT "client_interests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_interests" ADD CONSTRAINT "client_interests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_interests_v" ADD CONSTRAINT "_client_interests_v_parent_id_client_interests_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."client_interests"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_interests_v" ADD CONSTRAINT "_client_interests_v_version_customer_id_customers_id_fk" FOREIGN KEY ("version_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_interests_v" ADD CONSTRAINT "_client_interests_v_version_product_id_products_id_fk" FOREIGN KEY ("version_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_interests_v" ADD CONSTRAINT "_client_interests_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_won_sale_id_sales_id_fk" FOREIGN KEY ("won_sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_source_lead_id_leads_id_fk" FOREIGN KEY ("source_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "opportunities_rels" ADD CONSTRAINT "opportunities_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "opportunities_rels" ADD CONSTRAINT "opportunities_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_opportunities_v" ADD CONSTRAINT "_opportunities_v_parent_id_opportunities_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_opportunities_v" ADD CONSTRAINT "_opportunities_v_version_customer_id_customers_id_fk" FOREIGN KEY ("version_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_opportunities_v" ADD CONSTRAINT "_opportunities_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_opportunities_v" ADD CONSTRAINT "_opportunities_v_version_won_sale_id_sales_id_fk" FOREIGN KEY ("version_won_sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_opportunities_v" ADD CONSTRAINT "_opportunities_v_version_source_lead_id_leads_id_fk" FOREIGN KEY ("version_source_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_opportunities_v_rels" ADD CONSTRAINT "_opportunities_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_opportunities_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_opportunities_v_rels" ADD CONSTRAINT "_opportunities_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sales_items" ADD CONSTRAINT "sales_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sales" ADD CONSTRAINT "sales_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sales" ADD CONSTRAINT "sales_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sales_v_version_items" ADD CONSTRAINT "_sales_v_version_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sales_v_version_items" ADD CONSTRAINT "_sales_v_version_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sales_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sales_v" ADD CONSTRAINT "_sales_v_parent_id_sales_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sales_v" ADD CONSTRAINT "_sales_v_version_customer_id_customers_id_fk" FOREIGN KEY ("version_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sales_v" ADD CONSTRAINT "_sales_v_version_opportunity_id_opportunities_id_fk" FOREIGN KEY ("version_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sales_v" ADD CONSTRAINT "_sales_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "after_sales_follow_ups" ADD CONSTRAINT "after_sales_follow_ups_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."after_sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "after_sales" ADD CONSTRAINT "after_sales_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "after_sales" ADD CONSTRAINT "after_sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "after_sales" ADD CONSTRAINT "after_sales_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_after_sales_v_version_follow_ups" ADD CONSTRAINT "_after_sales_v_version_follow_ups_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_after_sales_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_after_sales_v" ADD CONSTRAINT "_after_sales_v_parent_id_after_sales_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."after_sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_after_sales_v" ADD CONSTRAINT "_after_sales_v_version_sale_id_sales_id_fk" FOREIGN KEY ("version_sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_after_sales_v" ADD CONSTRAINT "_after_sales_v_version_customer_id_customers_id_fk" FOREIGN KEY ("version_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_after_sales_v" ADD CONSTRAINT "_after_sales_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tasks_rels" ADD CONSTRAINT "tasks_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tasks_rels" ADD CONSTRAINT "tasks_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tasks_rels" ADD CONSTRAINT "tasks_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tasks_rels" ADD CONSTRAINT "tasks_rels_opportunities_fk" FOREIGN KEY ("opportunities_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tasks_rels" ADD CONSTRAINT "tasks_rels_sales_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tasks_rels" ADD CONSTRAINT "tasks_rels_after_sales_fk" FOREIGN KEY ("after_sales_id") REFERENCES "public"."after_sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tasks_rels" ADD CONSTRAINT "tasks_rels_shipments_fk" FOREIGN KEY ("shipments_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tasks_rels" ADD CONSTRAINT "tasks_rels_occurrences_fk" FOREIGN KEY ("occurrences_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tasks_v" ADD CONSTRAINT "_tasks_v_parent_id_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tasks_v" ADD CONSTRAINT "_tasks_v_version_assignee_id_users_id_fk" FOREIGN KEY ("version_assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tasks_v_rels" ADD CONSTRAINT "_tasks_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_tasks_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tasks_v_rels" ADD CONSTRAINT "_tasks_v_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tasks_v_rels" ADD CONSTRAINT "_tasks_v_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tasks_v_rels" ADD CONSTRAINT "_tasks_v_rels_opportunities_fk" FOREIGN KEY ("opportunities_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tasks_v_rels" ADD CONSTRAINT "_tasks_v_rels_sales_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tasks_v_rels" ADD CONSTRAINT "_tasks_v_rels_after_sales_fk" FOREIGN KEY ("after_sales_id") REFERENCES "public"."after_sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tasks_v_rels" ADD CONSTRAINT "_tasks_v_rels_shipments_fk" FOREIGN KEY ("shipments_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tasks_v_rels" ADD CONSTRAINT "_tasks_v_rels_occurrences_fk" FOREIGN KEY ("occurrences_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_after_sales_case_id_after_sales_id_fk" FOREIGN KEY ("after_sales_case_id") REFERENCES "public"."after_sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_shipments_v" ADD CONSTRAINT "_shipments_v_parent_id_shipments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_shipments_v" ADD CONSTRAINT "_shipments_v_version_after_sales_case_id_after_sales_id_fk" FOREIGN KEY ("version_after_sales_case_id") REFERENCES "public"."after_sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_shipments_v" ADD CONSTRAINT "_shipments_v_version_sale_id_sales_id_fk" FOREIGN KEY ("version_sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_shipments_v" ADD CONSTRAINT "_shipments_v_version_customer_id_customers_id_fk" FOREIGN KEY ("version_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_after_sales_case_id_after_sales_id_fk" FOREIGN KEY ("after_sales_case_id") REFERENCES "public"."after_sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_occurrences_v" ADD CONSTRAINT "_occurrences_v_parent_id_occurrences_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."occurrences"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_occurrences_v" ADD CONSTRAINT "_occurrences_v_version_after_sales_case_id_after_sales_id_fk" FOREIGN KEY ("version_after_sales_case_id") REFERENCES "public"."after_sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_occurrences_v" ADD CONSTRAINT "_occurrences_v_version_sale_id_sales_id_fk" FOREIGN KEY ("version_sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_occurrences_v" ADD CONSTRAINT "_occurrences_v_version_customer_id_customers_id_fk" FOREIGN KEY ("version_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_occurrences_v" ADD CONSTRAINT "_occurrences_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activities" ADD CONSTRAINT "activities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_opportunities_fk" FOREIGN KEY ("opportunities_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_sales_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_after_sales_fk" FOREIGN KEY ("after_sales_id") REFERENCES "public"."after_sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_tasks_fk" FOREIGN KEY ("tasks_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_shipments_fk" FOREIGN KEY ("shipments_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_occurrences_fk" FOREIGN KEY ("occurrences_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_client_interests_fk" FOREIGN KEY ("client_interests_id") REFERENCES "public"."client_interests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_file_id_report_export_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."report_export_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_report_export_files_fk" FOREIGN KEY ("report_export_files_id") REFERENCES "public"."report_export_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_client_interests_fk" FOREIGN KEY ("client_interests_id") REFERENCES "public"."client_interests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_opportunities_fk" FOREIGN KEY ("opportunities_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sales_fk" FOREIGN KEY ("sales_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_after_sales_fk" FOREIGN KEY ("after_sales_id") REFERENCES "public"."after_sales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tasks_fk" FOREIGN KEY ("tasks_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shipments_fk" FOREIGN KEY ("shipments_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_occurrences_fk" FOREIGN KEY ("occurrences_id") REFERENCES "public"."occurrences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activities_fk" FOREIGN KEY ("activities_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_report_exports_fk" FOREIGN KEY ("report_exports_id") REFERENCES "public"."report_exports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_hero_slides" ADD CONSTRAINT "home_hero_slides_desktop_image_image_id_media_id_fk" FOREIGN KEY ("desktop_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_hero_slides" ADD CONSTRAINT "home_hero_slides_mobile_image_image_id_media_id_fk" FOREIGN KEY ("mobile_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_hero_slides" ADD CONSTRAINT "home_hero_slides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_matter_panels" ADD CONSTRAINT "home_matter_panels_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_matter_panels" ADD CONSTRAINT "home_matter_panels_image_image_id_media_id_fk" FOREIGN KEY ("image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_matter_panels" ADD CONSTRAINT "home_matter_panels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_signature_slides" ADD CONSTRAINT "home_signature_slides_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_signature_slides" ADD CONSTRAINT "home_signature_slides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_provenance_steps" ADD CONSTRAINT "home_provenance_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_manifesto_primary_image_image_id_media_id_fk" FOREIGN KEY ("manifesto_primary_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_manifesto_secondary_image_image_id_media_id_fk" FOREIGN KEY ("manifesto_secondary_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_provenance_image_image_id_media_id_fk" FOREIGN KEY ("provenance_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home" ADD CONSTRAINT "home_seo_social_image_id_media_id_fk" FOREIGN KEY ("seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_rels" ADD CONSTRAINT "home_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_rels" ADD CONSTRAINT "home_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_hero_slides" ADD CONSTRAINT "_home_v_version_hero_slides_desktop_image_image_id_media_id_fk" FOREIGN KEY ("desktop_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v_version_hero_slides" ADD CONSTRAINT "_home_v_version_hero_slides_mobile_image_image_id_media_id_fk" FOREIGN KEY ("mobile_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v_version_hero_slides" ADD CONSTRAINT "_home_v_version_hero_slides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_matter_panels" ADD CONSTRAINT "_home_v_version_matter_panels_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v_version_matter_panels" ADD CONSTRAINT "_home_v_version_matter_panels_image_image_id_media_id_fk" FOREIGN KEY ("image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v_version_matter_panels" ADD CONSTRAINT "_home_v_version_matter_panels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_signature_slides" ADD CONSTRAINT "_home_v_version_signature_slides_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v_version_signature_slides" ADD CONSTRAINT "_home_v_version_signature_slides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_provenance_steps" ADD CONSTRAINT "_home_v_version_provenance_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_manifesto_primary_image_image_id_media_id_fk" FOREIGN KEY ("version_manifesto_primary_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_manifesto_secondary_image_image_id_media_id_fk" FOREIGN KEY ("version_manifesto_secondary_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_provenance_image_image_id_media_id_fk" FOREIGN KEY ("version_provenance_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v" ADD CONSTRAINT "_home_v_version_seo_social_image_id_media_id_fk" FOREIGN KEY ("version_seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v_rels" ADD CONSTRAINT "_home_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_rels" ADD CONSTRAINT "_home_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about" ADD CONSTRAINT "about_hero_image_image_id_media_id_fk" FOREIGN KEY ("hero_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about" ADD CONSTRAINT "about_maison_image_image_id_media_id_fk" FOREIGN KEY ("maison_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about" ADD CONSTRAINT "about_vision_image_image_id_media_id_fk" FOREIGN KEY ("vision_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about" ADD CONSTRAINT "about_provenance_image_image_id_media_id_fk" FOREIGN KEY ("provenance_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about" ADD CONSTRAINT "about_seo_social_image_id_media_id_fk" FOREIGN KEY ("seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_v" ADD CONSTRAINT "_about_v_version_hero_image_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_v" ADD CONSTRAINT "_about_v_version_maison_image_image_id_media_id_fk" FOREIGN KEY ("version_maison_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_v" ADD CONSTRAINT "_about_v_version_vision_image_image_id_media_id_fk" FOREIGN KEY ("version_vision_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_v" ADD CONSTRAINT "_about_v_version_provenance_image_image_id_media_id_fk" FOREIGN KEY ("version_provenance_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_v" ADD CONSTRAINT "_about_v_version_seo_social_image_id_media_id_fk" FOREIGN KEY ("version_seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contact_channels" ADD CONSTRAINT "contact_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contact" ADD CONSTRAINT "contact_image_image_id_media_id_fk" FOREIGN KEY ("image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contact" ADD CONSTRAINT "contact_seo_social_image_id_media_id_fk" FOREIGN KEY ("seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contact_v_version_channels" ADD CONSTRAINT "_contact_v_version_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_contact_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_contact_v" ADD CONSTRAINT "_contact_v_version_image_image_id_media_id_fk" FOREIGN KEY ("version_image_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contact_v" ADD CONSTRAINT "_contact_v_version_seo_social_image_id_media_id_fk" FOREIGN KEY ("version_seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "collection_page_visible_filters" ADD CONSTRAINT "collection_page_visible_filters_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."collection_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "collection_page" ADD CONSTRAINT "collection_page_seo_social_image_id_media_id_fk" FOREIGN KEY ("seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_collection_page_v_version_visible_filters" ADD CONSTRAINT "_collection_page_v_version_visible_filters_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_collection_page_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_collection_page_v" ADD CONSTRAINT "_collection_page_v_version_seo_social_image_id_media_id_fk" FOREIGN KEY ("version_seo_social_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "navigation_main_links" ADD CONSTRAINT "navigation_main_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_utility_links" ADD CONSTRAINT "navigation_utility_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_rels" ADD CONSTRAINT "navigation_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "navigation_rels" ADD CONSTRAINT "navigation_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_navigation_v_version_main_links" ADD CONSTRAINT "_navigation_v_version_main_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_navigation_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_navigation_v_version_utility_links" ADD CONSTRAINT "_navigation_v_version_utility_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_navigation_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_navigation_v_rels" ADD CONSTRAINT "_navigation_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_navigation_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_navigation_v_rels" ADD CONSTRAINT "_navigation_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_official_channels" ADD CONSTRAINT "site_settings_official_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_settings_v_version_official_channels" ADD CONSTRAINT "_site_settings_v_version_official_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "after_sales_automation_rels" ADD CONSTRAINT "after_sales_automation_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."after_sales_automation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "after_sales_automation_rels" ADD CONSTRAINT "after_sales_automation_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "after_sales_automation_rels" ADD CONSTRAINT "after_sales_automation_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_after_sales_automation_v_rels" ADD CONSTRAINT "_after_sales_automation_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_after_sales_automation_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_after_sales_automation_v_rels" ADD CONSTRAINT "_after_sales_automation_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_after_sales_automation_v_rels" ADD CONSTRAINT "_after_sales_automation_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_wide_sizes_wide_filename_idx" ON "media" USING btree ("sizes_wide_filename");
  CREATE INDEX "report_export_files_updated_at_idx" ON "report_export_files" USING btree ("updated_at");
  CREATE INDEX "report_export_files_created_at_idx" ON "report_export_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "report_export_files_filename_idx" ON "report_export_files" USING btree ("filename");
  CREATE INDEX "categories_search_terms_order_idx" ON "categories_search_terms" USING btree ("_order");
  CREATE INDEX "categories_search_terms_parent_id_idx" ON "categories_search_terms" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "categories_title_idx" ON "categories" USING btree ("title");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_image_idx" ON "categories" USING btree ("image_id");
  CREATE INDEX "categories_seo_seo_social_image_idx" ON "categories" USING btree ("seo_social_image_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "categories_deleted_at_idx" ON "categories" USING btree ("deleted_at");
  CREATE INDEX "categories__status_idx" ON "categories" USING btree ("_status");
  CREATE INDEX "_categories_v_version_search_terms_order_idx" ON "_categories_v_version_search_terms" USING btree ("_order");
  CREATE INDEX "_categories_v_version_search_terms_parent_id_idx" ON "_categories_v_version_search_terms" USING btree ("_parent_id");
  CREATE INDEX "_categories_v_parent_idx" ON "_categories_v" USING btree ("parent_id");
  CREATE INDEX "_categories_v_version_version_title_idx" ON "_categories_v" USING btree ("version_title");
  CREATE INDEX "_categories_v_version_version_slug_idx" ON "_categories_v" USING btree ("version_slug");
  CREATE INDEX "_categories_v_version_version_parent_idx" ON "_categories_v" USING btree ("version_parent_id");
  CREATE INDEX "_categories_v_version_version_image_idx" ON "_categories_v" USING btree ("version_image_id");
  CREATE INDEX "_categories_v_version_seo_version_seo_social_image_idx" ON "_categories_v" USING btree ("version_seo_social_image_id");
  CREATE INDEX "_categories_v_version_version_updated_at_idx" ON "_categories_v" USING btree ("version_updated_at");
  CREATE INDEX "_categories_v_version_version_created_at_idx" ON "_categories_v" USING btree ("version_created_at");
  CREATE INDEX "_categories_v_version_version_deleted_at_idx" ON "_categories_v" USING btree ("version_deleted_at");
  CREATE INDEX "_categories_v_version_version__status_idx" ON "_categories_v" USING btree ("version__status");
  CREATE INDEX "_categories_v_created_at_idx" ON "_categories_v" USING btree ("created_at");
  CREATE INDEX "_categories_v_updated_at_idx" ON "_categories_v" USING btree ("updated_at");
  CREATE INDEX "_categories_v_latest_idx" ON "_categories_v" USING btree ("latest");
  CREATE INDEX "products_attributes_order_idx" ON "products_attributes" USING btree ("_order");
  CREATE INDEX "products_attributes_parent_id_idx" ON "products_attributes" USING btree ("_parent_id");
  CREATE INDEX "products_gallery_order_idx" ON "products_gallery" USING btree ("_order");
  CREATE INDEX "products_gallery_parent_id_idx" ON "products_gallery" USING btree ("_parent_id");
  CREATE INDEX "products_gallery_image_idx" ON "products_gallery" USING btree ("image_id");
  CREATE INDEX "products_option_definitions_values_order_idx" ON "products_option_definitions_values" USING btree ("_order");
  CREATE INDEX "products_option_definitions_values_parent_id_idx" ON "products_option_definitions_values" USING btree ("_parent_id");
  CREATE INDEX "products_option_definitions_order_idx" ON "products_option_definitions" USING btree ("_order");
  CREATE INDEX "products_option_definitions_parent_id_idx" ON "products_option_definitions" USING btree ("_parent_id");
  CREATE INDEX "products_variants_selection_order_idx" ON "products_variants_selection" USING btree ("_order");
  CREATE INDEX "products_variants_selection_parent_id_idx" ON "products_variants_selection" USING btree ("_parent_id");
  CREATE INDEX "products_variants_media_keys_order_idx" ON "products_variants_media_keys" USING btree ("_order");
  CREATE INDEX "products_variants_media_keys_parent_id_idx" ON "products_variants_media_keys" USING btree ("_parent_id");
  CREATE INDEX "products_variants_order_idx" ON "products_variants" USING btree ("_order");
  CREATE INDEX "products_variants_parent_id_idx" ON "products_variants" USING btree ("_parent_id");
  CREATE INDEX "products_search_terms_order_idx" ON "products_search_terms" USING btree ("_order");
  CREATE INDEX "products_search_terms_parent_id_idx" ON "products_search_terms" USING btree ("_parent_id");
  CREATE INDEX "products_tags_order_idx" ON "products_tags" USING btree ("_order");
  CREATE INDEX "products_tags_parent_id_idx" ON "products_tags" USING btree ("_parent_id");
  CREATE INDEX "products_publication_issues_order_idx" ON "products_publication_issues" USING btree ("_order");
  CREATE INDEX "products_publication_issues_parent_id_idx" ON "products_publication_issues" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "products_title_idx" ON "products" USING btree ("title");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE UNIQUE INDEX "products_code_idx" ON "products" USING btree ("code");
  CREATE INDEX "products_seo_seo_social_image_idx" ON "products" USING btree ("seo_social_image_id");
  CREATE INDEX "products_publication_ready_idx" ON "products" USING btree ("publication_ready");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products_deleted_at_idx" ON "products" USING btree ("deleted_at");
  CREATE INDEX "products__status_idx" ON "products" USING btree ("_status");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_categories_id_idx" ON "products_rels" USING btree ("categories_id");
  CREATE INDEX "_products_v_version_attributes_order_idx" ON "_products_v_version_attributes" USING btree ("_order");
  CREATE INDEX "_products_v_version_attributes_parent_id_idx" ON "_products_v_version_attributes" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_gallery_order_idx" ON "_products_v_version_gallery" USING btree ("_order");
  CREATE INDEX "_products_v_version_gallery_parent_id_idx" ON "_products_v_version_gallery" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_gallery_image_idx" ON "_products_v_version_gallery" USING btree ("image_id");
  CREATE INDEX "_products_v_version_option_definitions_values_order_idx" ON "_products_v_version_option_definitions_values" USING btree ("_order");
  CREATE INDEX "_products_v_version_option_definitions_values_parent_id_idx" ON "_products_v_version_option_definitions_values" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_option_definitions_order_idx" ON "_products_v_version_option_definitions" USING btree ("_order");
  CREATE INDEX "_products_v_version_option_definitions_parent_id_idx" ON "_products_v_version_option_definitions" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_variants_selection_order_idx" ON "_products_v_version_variants_selection" USING btree ("_order");
  CREATE INDEX "_products_v_version_variants_selection_parent_id_idx" ON "_products_v_version_variants_selection" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_variants_media_keys_order_idx" ON "_products_v_version_variants_media_keys" USING btree ("_order");
  CREATE INDEX "_products_v_version_variants_media_keys_parent_id_idx" ON "_products_v_version_variants_media_keys" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_variants_order_idx" ON "_products_v_version_variants" USING btree ("_order");
  CREATE INDEX "_products_v_version_variants_parent_id_idx" ON "_products_v_version_variants" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_search_terms_order_idx" ON "_products_v_version_search_terms" USING btree ("_order");
  CREATE INDEX "_products_v_version_search_terms_parent_id_idx" ON "_products_v_version_search_terms" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_tags_order_idx" ON "_products_v_version_tags" USING btree ("_order");
  CREATE INDEX "_products_v_version_tags_parent_id_idx" ON "_products_v_version_tags" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_publication_issues_order_idx" ON "_products_v_version_publication_issues" USING btree ("_order");
  CREATE INDEX "_products_v_version_publication_issues_parent_id_idx" ON "_products_v_version_publication_issues" USING btree ("_parent_id");
  CREATE INDEX "_products_v_parent_idx" ON "_products_v" USING btree ("parent_id");
  CREATE INDEX "_products_v_version_version_title_idx" ON "_products_v" USING btree ("version_title");
  CREATE INDEX "_products_v_version_version_slug_idx" ON "_products_v" USING btree ("version_slug");
  CREATE INDEX "_products_v_version_version_code_idx" ON "_products_v" USING btree ("version_code");
  CREATE INDEX "_products_v_version_seo_version_seo_social_image_idx" ON "_products_v" USING btree ("version_seo_social_image_id");
  CREATE INDEX "_products_v_version_version_publication_ready_idx" ON "_products_v" USING btree ("version_publication_ready");
  CREATE INDEX "_products_v_version_version_updated_at_idx" ON "_products_v" USING btree ("version_updated_at");
  CREATE INDEX "_products_v_version_version_created_at_idx" ON "_products_v" USING btree ("version_created_at");
  CREATE INDEX "_products_v_version_version_deleted_at_idx" ON "_products_v" USING btree ("version_deleted_at");
  CREATE INDEX "_products_v_version_version__status_idx" ON "_products_v" USING btree ("version__status");
  CREATE INDEX "_products_v_created_at_idx" ON "_products_v" USING btree ("created_at");
  CREATE INDEX "_products_v_updated_at_idx" ON "_products_v" USING btree ("updated_at");
  CREATE INDEX "_products_v_latest_idx" ON "_products_v" USING btree ("latest");
  CREATE INDEX "_products_v_rels_order_idx" ON "_products_v_rels" USING btree ("order");
  CREATE INDEX "_products_v_rels_parent_idx" ON "_products_v_rels" USING btree ("parent_id");
  CREATE INDEX "_products_v_rels_path_idx" ON "_products_v_rels" USING btree ("path");
  CREATE INDEX "_products_v_rels_categories_id_idx" ON "_products_v_rels" USING btree ("categories_id");
  CREATE INDEX "leads_owner_idx" ON "leads" USING btree ("owner_id");
  CREATE INDEX "leads_customer_idx" ON "leads" USING btree ("customer_id");
  CREATE INDEX "leads_opportunity_idx" ON "leads" USING btree ("opportunity_id");
  CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage");
  CREATE INDEX "leads_closed_at_idx" ON "leads" USING btree ("closed_at");
  CREATE INDEX "leads_updated_at_idx" ON "leads" USING btree ("updated_at");
  CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");
  CREATE INDEX "leads_deleted_at_idx" ON "leads" USING btree ("deleted_at");
  CREATE INDEX "leads_rels_order_idx" ON "leads_rels" USING btree ("order");
  CREATE INDEX "leads_rels_parent_idx" ON "leads_rels" USING btree ("parent_id");
  CREATE INDEX "leads_rels_path_idx" ON "leads_rels" USING btree ("path");
  CREATE INDEX "leads_rels_categories_id_idx" ON "leads_rels" USING btree ("categories_id");
  CREATE INDEX "leads_rels_products_id_idx" ON "leads_rels" USING btree ("products_id");
  CREATE INDEX "_leads_v_parent_idx" ON "_leads_v" USING btree ("parent_id");
  CREATE INDEX "_leads_v_version_version_owner_idx" ON "_leads_v" USING btree ("version_owner_id");
  CREATE INDEX "_leads_v_version_version_customer_idx" ON "_leads_v" USING btree ("version_customer_id");
  CREATE INDEX "_leads_v_version_version_opportunity_idx" ON "_leads_v" USING btree ("version_opportunity_id");
  CREATE INDEX "_leads_v_version_version_stage_idx" ON "_leads_v" USING btree ("version_stage");
  CREATE INDEX "_leads_v_version_version_closed_at_idx" ON "_leads_v" USING btree ("version_closed_at");
  CREATE INDEX "_leads_v_version_version_updated_at_idx" ON "_leads_v" USING btree ("version_updated_at");
  CREATE INDEX "_leads_v_version_version_created_at_idx" ON "_leads_v" USING btree ("version_created_at");
  CREATE INDEX "_leads_v_version_version_deleted_at_idx" ON "_leads_v" USING btree ("version_deleted_at");
  CREATE INDEX "_leads_v_created_at_idx" ON "_leads_v" USING btree ("created_at");
  CREATE INDEX "_leads_v_updated_at_idx" ON "_leads_v" USING btree ("updated_at");
  CREATE INDEX "_leads_v_rels_order_idx" ON "_leads_v_rels" USING btree ("order");
  CREATE INDEX "_leads_v_rels_parent_idx" ON "_leads_v_rels" USING btree ("parent_id");
  CREATE INDEX "_leads_v_rels_path_idx" ON "_leads_v_rels" USING btree ("path");
  CREATE INDEX "_leads_v_rels_categories_id_idx" ON "_leads_v_rels" USING btree ("categories_id");
  CREATE INDEX "_leads_v_rels_products_id_idx" ON "_leads_v_rels" USING btree ("products_id");
  CREATE INDEX "customers_interest_profile_materials_order_idx" ON "customers_interest_profile_materials" USING btree ("_order");
  CREATE INDEX "customers_interest_profile_materials_parent_id_idx" ON "customers_interest_profile_materials" USING btree ("_parent_id");
  CREATE INDEX "customers_preferences_order_idx" ON "customers_preferences" USING btree ("_order");
  CREATE INDEX "customers_preferences_parent_id_idx" ON "customers_preferences" USING btree ("_parent_id");
  CREATE INDEX "customers_tags_order_idx" ON "customers_tags" USING btree ("_order");
  CREATE INDEX "customers_tags_parent_id_idx" ON "customers_tags" USING btree ("_parent_id");
  CREATE INDEX "customers_normalized_phone_idx" ON "customers" USING btree ("normalized_phone");
  CREATE INDEX "customers_normalized_email_idx" ON "customers" USING btree ("normalized_email");
  CREATE INDEX "customers_status_idx" ON "customers" USING btree ("status");
  CREATE INDEX "customers_origin_idx" ON "customers" USING btree ("origin");
  CREATE INDEX "customers_owner_idx" ON "customers" USING btree ("owner_id");
  CREATE INDEX "customers_source_lead_idx" ON "customers" USING btree ("source_lead_id");
  CREATE INDEX "customers_merged_into_idx" ON "customers" USING btree ("merged_into_id");
  CREATE INDEX "customers_privacy_request_status_idx" ON "customers" USING btree ("privacy_request_status");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "customers_deleted_at_idx" ON "customers" USING btree ("deleted_at");
  CREATE INDEX "customers_rels_order_idx" ON "customers_rels" USING btree ("order");
  CREATE INDEX "customers_rels_parent_idx" ON "customers_rels" USING btree ("parent_id");
  CREATE INDEX "customers_rels_path_idx" ON "customers_rels" USING btree ("path");
  CREATE INDEX "customers_rels_categories_id_idx" ON "customers_rels" USING btree ("categories_id");
  CREATE INDEX "_customers_v_version_interest_profile_materials_order_idx" ON "_customers_v_version_interest_profile_materials" USING btree ("_order");
  CREATE INDEX "_customers_v_version_interest_profile_materials_parent_id_idx" ON "_customers_v_version_interest_profile_materials" USING btree ("_parent_id");
  CREATE INDEX "_customers_v_version_preferences_order_idx" ON "_customers_v_version_preferences" USING btree ("_order");
  CREATE INDEX "_customers_v_version_preferences_parent_id_idx" ON "_customers_v_version_preferences" USING btree ("_parent_id");
  CREATE INDEX "_customers_v_version_tags_order_idx" ON "_customers_v_version_tags" USING btree ("_order");
  CREATE INDEX "_customers_v_version_tags_parent_id_idx" ON "_customers_v_version_tags" USING btree ("_parent_id");
  CREATE INDEX "_customers_v_parent_idx" ON "_customers_v" USING btree ("parent_id");
  CREATE INDEX "_customers_v_version_version_normalized_phone_idx" ON "_customers_v" USING btree ("version_normalized_phone");
  CREATE INDEX "_customers_v_version_version_normalized_email_idx" ON "_customers_v" USING btree ("version_normalized_email");
  CREATE INDEX "_customers_v_version_version_status_idx" ON "_customers_v" USING btree ("version_status");
  CREATE INDEX "_customers_v_version_version_origin_idx" ON "_customers_v" USING btree ("version_origin");
  CREATE INDEX "_customers_v_version_version_owner_idx" ON "_customers_v" USING btree ("version_owner_id");
  CREATE INDEX "_customers_v_version_version_source_lead_idx" ON "_customers_v" USING btree ("version_source_lead_id");
  CREATE INDEX "_customers_v_version_version_merged_into_idx" ON "_customers_v" USING btree ("version_merged_into_id");
  CREATE INDEX "_customers_v_version_version_privacy_request_status_idx" ON "_customers_v" USING btree ("version_privacy_request_status");
  CREATE INDEX "_customers_v_version_version_updated_at_idx" ON "_customers_v" USING btree ("version_updated_at");
  CREATE INDEX "_customers_v_version_version_created_at_idx" ON "_customers_v" USING btree ("version_created_at");
  CREATE INDEX "_customers_v_version_version_deleted_at_idx" ON "_customers_v" USING btree ("version_deleted_at");
  CREATE INDEX "_customers_v_created_at_idx" ON "_customers_v" USING btree ("created_at");
  CREATE INDEX "_customers_v_updated_at_idx" ON "_customers_v" USING btree ("updated_at");
  CREATE INDEX "_customers_v_rels_order_idx" ON "_customers_v_rels" USING btree ("order");
  CREATE INDEX "_customers_v_rels_parent_idx" ON "_customers_v_rels" USING btree ("parent_id");
  CREATE INDEX "_customers_v_rels_path_idx" ON "_customers_v_rels" USING btree ("path");
  CREATE INDEX "_customers_v_rels_categories_id_idx" ON "_customers_v_rels" USING btree ("categories_id");
  CREATE INDEX "client_interests_customer_idx" ON "client_interests" USING btree ("customer_id");
  CREATE INDEX "client_interests_product_idx" ON "client_interests" USING btree ("product_id");
  CREATE INDEX "client_interests_status_idx" ON "client_interests" USING btree ("status");
  CREATE INDEX "client_interests_owner_idx" ON "client_interests" USING btree ("owner_id");
  CREATE INDEX "client_interests_updated_at_idx" ON "client_interests" USING btree ("updated_at");
  CREATE INDEX "client_interests_created_at_idx" ON "client_interests" USING btree ("created_at");
  CREATE INDEX "client_interests_deleted_at_idx" ON "client_interests" USING btree ("deleted_at");
  CREATE INDEX "_client_interests_v_parent_idx" ON "_client_interests_v" USING btree ("parent_id");
  CREATE INDEX "_client_interests_v_version_version_customer_idx" ON "_client_interests_v" USING btree ("version_customer_id");
  CREATE INDEX "_client_interests_v_version_version_product_idx" ON "_client_interests_v" USING btree ("version_product_id");
  CREATE INDEX "_client_interests_v_version_version_status_idx" ON "_client_interests_v" USING btree ("version_status");
  CREATE INDEX "_client_interests_v_version_version_owner_idx" ON "_client_interests_v" USING btree ("version_owner_id");
  CREATE INDEX "_client_interests_v_version_version_updated_at_idx" ON "_client_interests_v" USING btree ("version_updated_at");
  CREATE INDEX "_client_interests_v_version_version_created_at_idx" ON "_client_interests_v" USING btree ("version_created_at");
  CREATE INDEX "_client_interests_v_version_version_deleted_at_idx" ON "_client_interests_v" USING btree ("version_deleted_at");
  CREATE INDEX "_client_interests_v_created_at_idx" ON "_client_interests_v" USING btree ("created_at");
  CREATE INDEX "_client_interests_v_updated_at_idx" ON "_client_interests_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "opportunities_code_idx" ON "opportunities" USING btree ("code");
  CREATE INDEX "opportunities_customer_idx" ON "opportunities" USING btree ("customer_id");
  CREATE INDEX "opportunities_source_idx" ON "opportunities" USING btree ("source");
  CREATE INDEX "opportunities_stage_idx" ON "opportunities" USING btree ("stage");
  CREATE INDEX "opportunities_rank_idx" ON "opportunities" USING btree ("rank");
  CREATE INDEX "opportunities_owner_idx" ON "opportunities" USING btree ("owner_id");
  CREATE INDEX "opportunities_priority_idx" ON "opportunities" USING btree ("priority");
  CREATE INDEX "opportunities_next_action_at_idx" ON "opportunities" USING btree ("next_action_at");
  CREATE INDEX "opportunities_expected_close_at_idx" ON "opportunities" USING btree ("expected_close_at");
  CREATE INDEX "opportunities_closed_at_idx" ON "opportunities" USING btree ("closed_at");
  CREATE UNIQUE INDEX "opportunities_won_sale_idx" ON "opportunities" USING btree ("won_sale_id");
  CREATE UNIQUE INDEX "opportunities_source_lead_idx" ON "opportunities" USING btree ("source_lead_id");
  CREATE INDEX "opportunities_migration_version_idx" ON "opportunities" USING btree ("migration_version");
  CREATE INDEX "opportunities_updated_at_idx" ON "opportunities" USING btree ("updated_at");
  CREATE INDEX "opportunities_created_at_idx" ON "opportunities" USING btree ("created_at");
  CREATE INDEX "opportunities_rels_order_idx" ON "opportunities_rels" USING btree ("order");
  CREATE INDEX "opportunities_rels_parent_idx" ON "opportunities_rels" USING btree ("parent_id");
  CREATE INDEX "opportunities_rels_path_idx" ON "opportunities_rels" USING btree ("path");
  CREATE INDEX "opportunities_rels_products_id_idx" ON "opportunities_rels" USING btree ("products_id");
  CREATE INDEX "_opportunities_v_parent_idx" ON "_opportunities_v" USING btree ("parent_id");
  CREATE INDEX "_opportunities_v_version_version_code_idx" ON "_opportunities_v" USING btree ("version_code");
  CREATE INDEX "_opportunities_v_version_version_customer_idx" ON "_opportunities_v" USING btree ("version_customer_id");
  CREATE INDEX "_opportunities_v_version_version_source_idx" ON "_opportunities_v" USING btree ("version_source");
  CREATE INDEX "_opportunities_v_version_version_stage_idx" ON "_opportunities_v" USING btree ("version_stage");
  CREATE INDEX "_opportunities_v_version_version_rank_idx" ON "_opportunities_v" USING btree ("version_rank");
  CREATE INDEX "_opportunities_v_version_version_owner_idx" ON "_opportunities_v" USING btree ("version_owner_id");
  CREATE INDEX "_opportunities_v_version_version_priority_idx" ON "_opportunities_v" USING btree ("version_priority");
  CREATE INDEX "_opportunities_v_version_version_next_action_at_idx" ON "_opportunities_v" USING btree ("version_next_action_at");
  CREATE INDEX "_opportunities_v_version_version_expected_close_at_idx" ON "_opportunities_v" USING btree ("version_expected_close_at");
  CREATE INDEX "_opportunities_v_version_version_closed_at_idx" ON "_opportunities_v" USING btree ("version_closed_at");
  CREATE INDEX "_opportunities_v_version_version_won_sale_idx" ON "_opportunities_v" USING btree ("version_won_sale_id");
  CREATE INDEX "_opportunities_v_version_version_source_lead_idx" ON "_opportunities_v" USING btree ("version_source_lead_id");
  CREATE INDEX "_opportunities_v_version_version_migration_version_idx" ON "_opportunities_v" USING btree ("version_migration_version");
  CREATE INDEX "_opportunities_v_version_version_updated_at_idx" ON "_opportunities_v" USING btree ("version_updated_at");
  CREATE INDEX "_opportunities_v_version_version_created_at_idx" ON "_opportunities_v" USING btree ("version_created_at");
  CREATE INDEX "_opportunities_v_created_at_idx" ON "_opportunities_v" USING btree ("created_at");
  CREATE INDEX "_opportunities_v_updated_at_idx" ON "_opportunities_v" USING btree ("updated_at");
  CREATE INDEX "_opportunities_v_rels_order_idx" ON "_opportunities_v_rels" USING btree ("order");
  CREATE INDEX "_opportunities_v_rels_parent_idx" ON "_opportunities_v_rels" USING btree ("parent_id");
  CREATE INDEX "_opportunities_v_rels_path_idx" ON "_opportunities_v_rels" USING btree ("path");
  CREATE INDEX "_opportunities_v_rels_products_id_idx" ON "_opportunities_v_rels" USING btree ("products_id");
  CREATE INDEX "sales_items_order_idx" ON "sales_items" USING btree ("_order");
  CREATE INDEX "sales_items_parent_id_idx" ON "sales_items" USING btree ("_parent_id");
  CREATE INDEX "sales_items_product_idx" ON "sales_items" USING btree ("product_id");
  CREATE UNIQUE INDEX "sales_number_idx" ON "sales" USING btree ("number");
  CREATE INDEX "sales_customer_idx" ON "sales" USING btree ("customer_id");
  CREATE UNIQUE INDEX "sales_opportunity_idx" ON "sales" USING btree ("opportunity_id");
  CREATE INDEX "sales_channel_idx" ON "sales" USING btree ("channel");
  CREATE INDEX "sales_status_idx" ON "sales" USING btree ("status");
  CREATE INDEX "sales_owner_idx" ON "sales" USING btree ("owner_id");
  CREATE INDEX "sales_confirmed_at_idx" ON "sales" USING btree ("confirmed_at");
  CREATE INDEX "sales_updated_at_idx" ON "sales" USING btree ("updated_at");
  CREATE INDEX "sales_created_at_idx" ON "sales" USING btree ("created_at");
  CREATE INDEX "sales_deleted_at_idx" ON "sales" USING btree ("deleted_at");
  CREATE INDEX "_sales_v_version_items_order_idx" ON "_sales_v_version_items" USING btree ("_order");
  CREATE INDEX "_sales_v_version_items_parent_id_idx" ON "_sales_v_version_items" USING btree ("_parent_id");
  CREATE INDEX "_sales_v_version_items_product_idx" ON "_sales_v_version_items" USING btree ("product_id");
  CREATE INDEX "_sales_v_parent_idx" ON "_sales_v" USING btree ("parent_id");
  CREATE INDEX "_sales_v_version_version_number_idx" ON "_sales_v" USING btree ("version_number");
  CREATE INDEX "_sales_v_version_version_customer_idx" ON "_sales_v" USING btree ("version_customer_id");
  CREATE INDEX "_sales_v_version_version_opportunity_idx" ON "_sales_v" USING btree ("version_opportunity_id");
  CREATE INDEX "_sales_v_version_version_channel_idx" ON "_sales_v" USING btree ("version_channel");
  CREATE INDEX "_sales_v_version_version_status_idx" ON "_sales_v" USING btree ("version_status");
  CREATE INDEX "_sales_v_version_version_owner_idx" ON "_sales_v" USING btree ("version_owner_id");
  CREATE INDEX "_sales_v_version_version_confirmed_at_idx" ON "_sales_v" USING btree ("version_confirmed_at");
  CREATE INDEX "_sales_v_version_version_updated_at_idx" ON "_sales_v" USING btree ("version_updated_at");
  CREATE INDEX "_sales_v_version_version_created_at_idx" ON "_sales_v" USING btree ("version_created_at");
  CREATE INDEX "_sales_v_version_version_deleted_at_idx" ON "_sales_v" USING btree ("version_deleted_at");
  CREATE INDEX "_sales_v_created_at_idx" ON "_sales_v" USING btree ("created_at");
  CREATE INDEX "_sales_v_updated_at_idx" ON "_sales_v" USING btree ("updated_at");
  CREATE INDEX "after_sales_follow_ups_order_idx" ON "after_sales_follow_ups" USING btree ("_order");
  CREATE INDEX "after_sales_follow_ups_parent_id_idx" ON "after_sales_follow_ups" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "after_sales_case_number_idx" ON "after_sales" USING btree ("case_number");
  CREATE INDEX "after_sales_sale_idx" ON "after_sales" USING btree ("sale_id");
  CREATE INDEX "after_sales_customer_idx" ON "after_sales" USING btree ("customer_id");
  CREATE INDEX "after_sales_status_idx" ON "after_sales" USING btree ("status");
  CREATE INDEX "after_sales_priority_idx" ON "after_sales" USING btree ("priority");
  CREATE INDEX "after_sales_owner_idx" ON "after_sales" USING btree ("owner_id");
  CREATE INDEX "after_sales_opened_at_idx" ON "after_sales" USING btree ("opened_at");
  CREATE INDEX "after_sales_closed_at_idx" ON "after_sales" USING btree ("closed_at");
  CREATE INDEX "after_sales_updated_at_idx" ON "after_sales" USING btree ("updated_at");
  CREATE INDEX "after_sales_created_at_idx" ON "after_sales" USING btree ("created_at");
  CREATE INDEX "after_sales_deleted_at_idx" ON "after_sales" USING btree ("deleted_at");
  CREATE INDEX "_after_sales_v_version_follow_ups_order_idx" ON "_after_sales_v_version_follow_ups" USING btree ("_order");
  CREATE INDEX "_after_sales_v_version_follow_ups_parent_id_idx" ON "_after_sales_v_version_follow_ups" USING btree ("_parent_id");
  CREATE INDEX "_after_sales_v_parent_idx" ON "_after_sales_v" USING btree ("parent_id");
  CREATE INDEX "_after_sales_v_version_version_case_number_idx" ON "_after_sales_v" USING btree ("version_case_number");
  CREATE INDEX "_after_sales_v_version_version_sale_idx" ON "_after_sales_v" USING btree ("version_sale_id");
  CREATE INDEX "_after_sales_v_version_version_customer_idx" ON "_after_sales_v" USING btree ("version_customer_id");
  CREATE INDEX "_after_sales_v_version_version_status_idx" ON "_after_sales_v" USING btree ("version_status");
  CREATE INDEX "_after_sales_v_version_version_priority_idx" ON "_after_sales_v" USING btree ("version_priority");
  CREATE INDEX "_after_sales_v_version_version_owner_idx" ON "_after_sales_v" USING btree ("version_owner_id");
  CREATE INDEX "_after_sales_v_version_version_opened_at_idx" ON "_after_sales_v" USING btree ("version_opened_at");
  CREATE INDEX "_after_sales_v_version_version_closed_at_idx" ON "_after_sales_v" USING btree ("version_closed_at");
  CREATE INDEX "_after_sales_v_version_version_updated_at_idx" ON "_after_sales_v" USING btree ("version_updated_at");
  CREATE INDEX "_after_sales_v_version_version_created_at_idx" ON "_after_sales_v" USING btree ("version_created_at");
  CREATE INDEX "_after_sales_v_version_version_deleted_at_idx" ON "_after_sales_v" USING btree ("version_deleted_at");
  CREATE INDEX "_after_sales_v_created_at_idx" ON "_after_sales_v" USING btree ("created_at");
  CREATE INDEX "_after_sales_v_updated_at_idx" ON "_after_sales_v" USING btree ("updated_at");
  CREATE INDEX "tasks_type_idx" ON "tasks" USING btree ("type");
  CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");
  CREATE INDEX "tasks_priority_idx" ON "tasks" USING btree ("priority");
  CREATE INDEX "tasks_due_at_idx" ON "tasks" USING btree ("due_at");
  CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id");
  CREATE UNIQUE INDEX "tasks_automation_key_idx" ON "tasks" USING btree ("automation_key");
  CREATE UNIQUE INDEX "tasks_legacy_source_key_idx" ON "tasks" USING btree ("legacy_source_key");
  CREATE INDEX "tasks_updated_at_idx" ON "tasks" USING btree ("updated_at");
  CREATE INDEX "tasks_created_at_idx" ON "tasks" USING btree ("created_at");
  CREATE INDEX "tasks_deleted_at_idx" ON "tasks" USING btree ("deleted_at");
  CREATE INDEX "tasks_rels_order_idx" ON "tasks_rels" USING btree ("order");
  CREATE INDEX "tasks_rels_parent_idx" ON "tasks_rels" USING btree ("parent_id");
  CREATE INDEX "tasks_rels_path_idx" ON "tasks_rels" USING btree ("path");
  CREATE INDEX "tasks_rels_leads_id_idx" ON "tasks_rels" USING btree ("leads_id");
  CREATE INDEX "tasks_rels_customers_id_idx" ON "tasks_rels" USING btree ("customers_id");
  CREATE INDEX "tasks_rels_opportunities_id_idx" ON "tasks_rels" USING btree ("opportunities_id");
  CREATE INDEX "tasks_rels_sales_id_idx" ON "tasks_rels" USING btree ("sales_id");
  CREATE INDEX "tasks_rels_after_sales_id_idx" ON "tasks_rels" USING btree ("after_sales_id");
  CREATE INDEX "tasks_rels_shipments_id_idx" ON "tasks_rels" USING btree ("shipments_id");
  CREATE INDEX "tasks_rels_occurrences_id_idx" ON "tasks_rels" USING btree ("occurrences_id");
  CREATE INDEX "_tasks_v_parent_idx" ON "_tasks_v" USING btree ("parent_id");
  CREATE INDEX "_tasks_v_version_version_type_idx" ON "_tasks_v" USING btree ("version_type");
  CREATE INDEX "_tasks_v_version_version_status_idx" ON "_tasks_v" USING btree ("version_status");
  CREATE INDEX "_tasks_v_version_version_priority_idx" ON "_tasks_v" USING btree ("version_priority");
  CREATE INDEX "_tasks_v_version_version_due_at_idx" ON "_tasks_v" USING btree ("version_due_at");
  CREATE INDEX "_tasks_v_version_version_assignee_idx" ON "_tasks_v" USING btree ("version_assignee_id");
  CREATE INDEX "_tasks_v_version_version_automation_key_idx" ON "_tasks_v" USING btree ("version_automation_key");
  CREATE INDEX "_tasks_v_version_version_legacy_source_key_idx" ON "_tasks_v" USING btree ("version_legacy_source_key");
  CREATE INDEX "_tasks_v_version_version_updated_at_idx" ON "_tasks_v" USING btree ("version_updated_at");
  CREATE INDEX "_tasks_v_version_version_created_at_idx" ON "_tasks_v" USING btree ("version_created_at");
  CREATE INDEX "_tasks_v_version_version_deleted_at_idx" ON "_tasks_v" USING btree ("version_deleted_at");
  CREATE INDEX "_tasks_v_created_at_idx" ON "_tasks_v" USING btree ("created_at");
  CREATE INDEX "_tasks_v_updated_at_idx" ON "_tasks_v" USING btree ("updated_at");
  CREATE INDEX "_tasks_v_rels_order_idx" ON "_tasks_v_rels" USING btree ("order");
  CREATE INDEX "_tasks_v_rels_parent_idx" ON "_tasks_v_rels" USING btree ("parent_id");
  CREATE INDEX "_tasks_v_rels_path_idx" ON "_tasks_v_rels" USING btree ("path");
  CREATE INDEX "_tasks_v_rels_leads_id_idx" ON "_tasks_v_rels" USING btree ("leads_id");
  CREATE INDEX "_tasks_v_rels_customers_id_idx" ON "_tasks_v_rels" USING btree ("customers_id");
  CREATE INDEX "_tasks_v_rels_opportunities_id_idx" ON "_tasks_v_rels" USING btree ("opportunities_id");
  CREATE INDEX "_tasks_v_rels_sales_id_idx" ON "_tasks_v_rels" USING btree ("sales_id");
  CREATE INDEX "_tasks_v_rels_after_sales_id_idx" ON "_tasks_v_rels" USING btree ("after_sales_id");
  CREATE INDEX "_tasks_v_rels_shipments_id_idx" ON "_tasks_v_rels" USING btree ("shipments_id");
  CREATE INDEX "_tasks_v_rels_occurrences_id_idx" ON "_tasks_v_rels" USING btree ("occurrences_id");
  CREATE INDEX "shipments_after_sales_case_idx" ON "shipments" USING btree ("after_sales_case_id");
  CREATE INDEX "shipments_sale_idx" ON "shipments" USING btree ("sale_id");
  CREATE INDEX "shipments_customer_idx" ON "shipments" USING btree ("customer_id");
  CREATE INDEX "shipments_tracking_code_idx" ON "shipments" USING btree ("tracking_code");
  CREATE INDEX "shipments_status_idx" ON "shipments" USING btree ("status");
  CREATE INDEX "shipments_estimated_delivery_idx" ON "shipments" USING btree ("estimated_delivery");
  CREATE INDEX "shipments_delivered_at_idx" ON "shipments" USING btree ("delivered_at");
  CREATE INDEX "shipments_updated_at_idx" ON "shipments" USING btree ("updated_at");
  CREATE INDEX "shipments_created_at_idx" ON "shipments" USING btree ("created_at");
  CREATE INDEX "shipments_deleted_at_idx" ON "shipments" USING btree ("deleted_at");
  CREATE INDEX "_shipments_v_parent_idx" ON "_shipments_v" USING btree ("parent_id");
  CREATE INDEX "_shipments_v_version_version_after_sales_case_idx" ON "_shipments_v" USING btree ("version_after_sales_case_id");
  CREATE INDEX "_shipments_v_version_version_sale_idx" ON "_shipments_v" USING btree ("version_sale_id");
  CREATE INDEX "_shipments_v_version_version_customer_idx" ON "_shipments_v" USING btree ("version_customer_id");
  CREATE INDEX "_shipments_v_version_version_tracking_code_idx" ON "_shipments_v" USING btree ("version_tracking_code");
  CREATE INDEX "_shipments_v_version_version_status_idx" ON "_shipments_v" USING btree ("version_status");
  CREATE INDEX "_shipments_v_version_version_estimated_delivery_idx" ON "_shipments_v" USING btree ("version_estimated_delivery");
  CREATE INDEX "_shipments_v_version_version_delivered_at_idx" ON "_shipments_v" USING btree ("version_delivered_at");
  CREATE INDEX "_shipments_v_version_version_updated_at_idx" ON "_shipments_v" USING btree ("version_updated_at");
  CREATE INDEX "_shipments_v_version_version_created_at_idx" ON "_shipments_v" USING btree ("version_created_at");
  CREATE INDEX "_shipments_v_version_version_deleted_at_idx" ON "_shipments_v" USING btree ("version_deleted_at");
  CREATE INDEX "_shipments_v_created_at_idx" ON "_shipments_v" USING btree ("created_at");
  CREATE INDEX "_shipments_v_updated_at_idx" ON "_shipments_v" USING btree ("updated_at");
  CREATE INDEX "occurrences_after_sales_case_idx" ON "occurrences" USING btree ("after_sales_case_id");
  CREATE INDEX "occurrences_sale_idx" ON "occurrences" USING btree ("sale_id");
  CREATE INDEX "occurrences_customer_idx" ON "occurrences" USING btree ("customer_id");
  CREATE INDEX "occurrences_type_idx" ON "occurrences" USING btree ("type");
  CREATE INDEX "occurrences_severity_idx" ON "occurrences" USING btree ("severity");
  CREATE INDEX "occurrences_status_idx" ON "occurrences" USING btree ("status");
  CREATE INDEX "occurrences_owner_idx" ON "occurrences" USING btree ("owner_id");
  CREATE INDEX "occurrences_opened_at_idx" ON "occurrences" USING btree ("opened_at");
  CREATE INDEX "occurrences_closed_at_idx" ON "occurrences" USING btree ("closed_at");
  CREATE INDEX "occurrences_updated_at_idx" ON "occurrences" USING btree ("updated_at");
  CREATE INDEX "occurrences_created_at_idx" ON "occurrences" USING btree ("created_at");
  CREATE INDEX "occurrences_deleted_at_idx" ON "occurrences" USING btree ("deleted_at");
  CREATE INDEX "_occurrences_v_parent_idx" ON "_occurrences_v" USING btree ("parent_id");
  CREATE INDEX "_occurrences_v_version_version_after_sales_case_idx" ON "_occurrences_v" USING btree ("version_after_sales_case_id");
  CREATE INDEX "_occurrences_v_version_version_sale_idx" ON "_occurrences_v" USING btree ("version_sale_id");
  CREATE INDEX "_occurrences_v_version_version_customer_idx" ON "_occurrences_v" USING btree ("version_customer_id");
  CREATE INDEX "_occurrences_v_version_version_type_idx" ON "_occurrences_v" USING btree ("version_type");
  CREATE INDEX "_occurrences_v_version_version_severity_idx" ON "_occurrences_v" USING btree ("version_severity");
  CREATE INDEX "_occurrences_v_version_version_status_idx" ON "_occurrences_v" USING btree ("version_status");
  CREATE INDEX "_occurrences_v_version_version_owner_idx" ON "_occurrences_v" USING btree ("version_owner_id");
  CREATE INDEX "_occurrences_v_version_version_opened_at_idx" ON "_occurrences_v" USING btree ("version_opened_at");
  CREATE INDEX "_occurrences_v_version_version_closed_at_idx" ON "_occurrences_v" USING btree ("version_closed_at");
  CREATE INDEX "_occurrences_v_version_version_updated_at_idx" ON "_occurrences_v" USING btree ("version_updated_at");
  CREATE INDEX "_occurrences_v_version_version_created_at_idx" ON "_occurrences_v" USING btree ("version_created_at");
  CREATE INDEX "_occurrences_v_version_version_deleted_at_idx" ON "_occurrences_v" USING btree ("version_deleted_at");
  CREATE INDEX "_occurrences_v_created_at_idx" ON "_occurrences_v" USING btree ("created_at");
  CREATE INDEX "_occurrences_v_updated_at_idx" ON "_occurrences_v" USING btree ("updated_at");
  CREATE INDEX "activities_event_type_idx" ON "activities" USING btree ("event_type");
  CREATE INDEX "activities_occurred_at_idx" ON "activities" USING btree ("occurred_at");
  CREATE INDEX "activities_owner_idx" ON "activities" USING btree ("owner_id");
  CREATE INDEX "activities_opportunity_idx" ON "activities" USING btree ("opportunity_id");
  CREATE INDEX "activities_to_stage_idx" ON "activities" USING btree ("to_stage");
  CREATE INDEX "activities_updated_at_idx" ON "activities" USING btree ("updated_at");
  CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");
  CREATE INDEX "activities_deleted_at_idx" ON "activities" USING btree ("deleted_at");
  CREATE INDEX "activities_rels_order_idx" ON "activities_rels" USING btree ("order");
  CREATE INDEX "activities_rels_parent_idx" ON "activities_rels" USING btree ("parent_id");
  CREATE INDEX "activities_rels_path_idx" ON "activities_rels" USING btree ("path");
  CREATE INDEX "activities_rels_leads_id_idx" ON "activities_rels" USING btree ("leads_id");
  CREATE INDEX "activities_rels_customers_id_idx" ON "activities_rels" USING btree ("customers_id");
  CREATE INDEX "activities_rels_opportunities_id_idx" ON "activities_rels" USING btree ("opportunities_id");
  CREATE INDEX "activities_rels_sales_id_idx" ON "activities_rels" USING btree ("sales_id");
  CREATE INDEX "activities_rels_after_sales_id_idx" ON "activities_rels" USING btree ("after_sales_id");
  CREATE INDEX "activities_rels_tasks_id_idx" ON "activities_rels" USING btree ("tasks_id");
  CREATE INDEX "activities_rels_shipments_id_idx" ON "activities_rels" USING btree ("shipments_id");
  CREATE INDEX "activities_rels_occurrences_id_idx" ON "activities_rels" USING btree ("occurrences_id");
  CREATE INDEX "activities_rels_client_interests_id_idx" ON "activities_rels" USING btree ("client_interests_id");
  CREATE INDEX "report_exports_status_idx" ON "report_exports" USING btree ("status");
  CREATE INDEX "report_exports_requested_at_idx" ON "report_exports" USING btree ("requested_at");
  CREATE INDEX "report_exports_requested_by_idx" ON "report_exports" USING btree ("requested_by_id");
  CREATE INDEX "report_exports_semantic_version_idx" ON "report_exports" USING btree ("semantic_version");
  CREATE INDEX "report_exports_file_idx" ON "report_exports" USING btree ("file_id");
  CREATE INDEX "report_exports_updated_at_idx" ON "report_exports" USING btree ("updated_at");
  CREATE INDEX "report_exports_created_at_idx" ON "report_exports" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_concurrency_key_idx" ON "payload_jobs" USING btree ("concurrency_key");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_report_export_files_id_idx" ON "payload_locked_documents_rels" USING btree ("report_export_files_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_leads_id_idx" ON "payload_locked_documents_rels" USING btree ("leads_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_client_interests_id_idx" ON "payload_locked_documents_rels" USING btree ("client_interests_id");
  CREATE INDEX "payload_locked_documents_rels_opportunities_id_idx" ON "payload_locked_documents_rels" USING btree ("opportunities_id");
  CREATE INDEX "payload_locked_documents_rels_sales_id_idx" ON "payload_locked_documents_rels" USING btree ("sales_id");
  CREATE INDEX "payload_locked_documents_rels_after_sales_id_idx" ON "payload_locked_documents_rels" USING btree ("after_sales_id");
  CREATE INDEX "payload_locked_documents_rels_tasks_id_idx" ON "payload_locked_documents_rels" USING btree ("tasks_id");
  CREATE INDEX "payload_locked_documents_rels_shipments_id_idx" ON "payload_locked_documents_rels" USING btree ("shipments_id");
  CREATE INDEX "payload_locked_documents_rels_occurrences_id_idx" ON "payload_locked_documents_rels" USING btree ("occurrences_id");
  CREATE INDEX "payload_locked_documents_rels_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("activities_id");
  CREATE INDEX "payload_locked_documents_rels_report_exports_id_idx" ON "payload_locked_documents_rels" USING btree ("report_exports_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "home_hero_slides_order_idx" ON "home_hero_slides" USING btree ("_order");
  CREATE INDEX "home_hero_slides_parent_id_idx" ON "home_hero_slides" USING btree ("_parent_id");
  CREATE INDEX "home_hero_slides_desktop_image_desktop_image_image_idx" ON "home_hero_slides" USING btree ("desktop_image_image_id");
  CREATE INDEX "home_hero_slides_mobile_image_mobile_image_image_idx" ON "home_hero_slides" USING btree ("mobile_image_image_id");
  CREATE INDEX "home_matter_panels_order_idx" ON "home_matter_panels" USING btree ("_order");
  CREATE INDEX "home_matter_panels_parent_id_idx" ON "home_matter_panels" USING btree ("_parent_id");
  CREATE INDEX "home_matter_panels_category_idx" ON "home_matter_panels" USING btree ("category_id");
  CREATE INDEX "home_matter_panels_image_image_image_idx" ON "home_matter_panels" USING btree ("image_image_id");
  CREATE INDEX "home_signature_slides_order_idx" ON "home_signature_slides" USING btree ("_order");
  CREATE INDEX "home_signature_slides_parent_id_idx" ON "home_signature_slides" USING btree ("_parent_id");
  CREATE INDEX "home_signature_slides_product_idx" ON "home_signature_slides" USING btree ("product_id");
  CREATE INDEX "home_provenance_steps_order_idx" ON "home_provenance_steps" USING btree ("_order");
  CREATE INDEX "home_provenance_steps_parent_id_idx" ON "home_provenance_steps" USING btree ("_parent_id");
  CREATE INDEX "home_manifesto_primary_image_manifesto_primary_image_ima_idx" ON "home" USING btree ("manifesto_primary_image_image_id");
  CREATE INDEX "home_manifesto_secondary_image_manifesto_secondary_image_idx" ON "home" USING btree ("manifesto_secondary_image_image_id");
  CREATE INDEX "home_provenance_image_provenance_image_image_idx" ON "home" USING btree ("provenance_image_image_id");
  CREATE INDEX "home_seo_seo_social_image_idx" ON "home" USING btree ("seo_social_image_id");
  CREATE INDEX "home__status_idx" ON "home" USING btree ("_status");
  CREATE INDEX "home_rels_order_idx" ON "home_rels" USING btree ("order");
  CREATE INDEX "home_rels_parent_idx" ON "home_rels" USING btree ("parent_id");
  CREATE INDEX "home_rels_path_idx" ON "home_rels" USING btree ("path");
  CREATE INDEX "home_rels_products_id_idx" ON "home_rels" USING btree ("products_id");
  CREATE INDEX "_home_v_version_hero_slides_order_idx" ON "_home_v_version_hero_slides" USING btree ("_order");
  CREATE INDEX "_home_v_version_hero_slides_parent_id_idx" ON "_home_v_version_hero_slides" USING btree ("_parent_id");
  CREATE INDEX "_home_v_version_hero_slides_desktop_image_desktop_image__idx" ON "_home_v_version_hero_slides" USING btree ("desktop_image_image_id");
  CREATE INDEX "_home_v_version_hero_slides_mobile_image_mobile_image_im_idx" ON "_home_v_version_hero_slides" USING btree ("mobile_image_image_id");
  CREATE INDEX "_home_v_version_matter_panels_order_idx" ON "_home_v_version_matter_panels" USING btree ("_order");
  CREATE INDEX "_home_v_version_matter_panels_parent_id_idx" ON "_home_v_version_matter_panels" USING btree ("_parent_id");
  CREATE INDEX "_home_v_version_matter_panels_category_idx" ON "_home_v_version_matter_panels" USING btree ("category_id");
  CREATE INDEX "_home_v_version_matter_panels_image_image_image_idx" ON "_home_v_version_matter_panels" USING btree ("image_image_id");
  CREATE INDEX "_home_v_version_signature_slides_order_idx" ON "_home_v_version_signature_slides" USING btree ("_order");
  CREATE INDEX "_home_v_version_signature_slides_parent_id_idx" ON "_home_v_version_signature_slides" USING btree ("_parent_id");
  CREATE INDEX "_home_v_version_signature_slides_product_idx" ON "_home_v_version_signature_slides" USING btree ("product_id");
  CREATE INDEX "_home_v_version_provenance_steps_order_idx" ON "_home_v_version_provenance_steps" USING btree ("_order");
  CREATE INDEX "_home_v_version_provenance_steps_parent_id_idx" ON "_home_v_version_provenance_steps" USING btree ("_parent_id");
  CREATE INDEX "_home_v_version_manifesto_primary_image_version_manifest_idx" ON "_home_v" USING btree ("version_manifesto_primary_image_image_id");
  CREATE INDEX "_home_v_version_manifesto_secondary_image_version_manife_idx" ON "_home_v" USING btree ("version_manifesto_secondary_image_image_id");
  CREATE INDEX "_home_v_version_provenance_image_version_provenance_imag_idx" ON "_home_v" USING btree ("version_provenance_image_image_id");
  CREATE INDEX "_home_v_version_seo_version_seo_social_image_idx" ON "_home_v" USING btree ("version_seo_social_image_id");
  CREATE INDEX "_home_v_version_version__status_idx" ON "_home_v" USING btree ("version__status");
  CREATE INDEX "_home_v_created_at_idx" ON "_home_v" USING btree ("created_at");
  CREATE INDEX "_home_v_updated_at_idx" ON "_home_v" USING btree ("updated_at");
  CREATE INDEX "_home_v_latest_idx" ON "_home_v" USING btree ("latest");
  CREATE INDEX "_home_v_rels_order_idx" ON "_home_v_rels" USING btree ("order");
  CREATE INDEX "_home_v_rels_parent_idx" ON "_home_v_rels" USING btree ("parent_id");
  CREATE INDEX "_home_v_rels_path_idx" ON "_home_v_rels" USING btree ("path");
  CREATE INDEX "_home_v_rels_products_id_idx" ON "_home_v_rels" USING btree ("products_id");
  CREATE INDEX "about_hero_image_hero_image_image_idx" ON "about" USING btree ("hero_image_image_id");
  CREATE INDEX "about_maison_image_maison_image_image_idx" ON "about" USING btree ("maison_image_image_id");
  CREATE INDEX "about_vision_image_vision_image_image_idx" ON "about" USING btree ("vision_image_image_id");
  CREATE INDEX "about_provenance_image_provenance_image_image_idx" ON "about" USING btree ("provenance_image_image_id");
  CREATE INDEX "about_seo_seo_social_image_idx" ON "about" USING btree ("seo_social_image_id");
  CREATE INDEX "about__status_idx" ON "about" USING btree ("_status");
  CREATE INDEX "_about_v_version_hero_image_version_hero_image_image_idx" ON "_about_v" USING btree ("version_hero_image_image_id");
  CREATE INDEX "_about_v_version_maison_image_version_maison_image_image_idx" ON "_about_v" USING btree ("version_maison_image_image_id");
  CREATE INDEX "_about_v_version_vision_image_version_vision_image_image_idx" ON "_about_v" USING btree ("version_vision_image_image_id");
  CREATE INDEX "_about_v_version_provenance_image_version_provenance_ima_idx" ON "_about_v" USING btree ("version_provenance_image_image_id");
  CREATE INDEX "_about_v_version_seo_version_seo_social_image_idx" ON "_about_v" USING btree ("version_seo_social_image_id");
  CREATE INDEX "_about_v_version_version__status_idx" ON "_about_v" USING btree ("version__status");
  CREATE INDEX "_about_v_created_at_idx" ON "_about_v" USING btree ("created_at");
  CREATE INDEX "_about_v_updated_at_idx" ON "_about_v" USING btree ("updated_at");
  CREATE INDEX "_about_v_latest_idx" ON "_about_v" USING btree ("latest");
  CREATE INDEX "contact_channels_order_idx" ON "contact_channels" USING btree ("_order");
  CREATE INDEX "contact_channels_parent_id_idx" ON "contact_channels" USING btree ("_parent_id");
  CREATE INDEX "contact_image_image_image_idx" ON "contact" USING btree ("image_image_id");
  CREATE INDEX "contact_seo_seo_social_image_idx" ON "contact" USING btree ("seo_social_image_id");
  CREATE INDEX "contact__status_idx" ON "contact" USING btree ("_status");
  CREATE INDEX "_contact_v_version_channels_order_idx" ON "_contact_v_version_channels" USING btree ("_order");
  CREATE INDEX "_contact_v_version_channels_parent_id_idx" ON "_contact_v_version_channels" USING btree ("_parent_id");
  CREATE INDEX "_contact_v_version_image_version_image_image_idx" ON "_contact_v" USING btree ("version_image_image_id");
  CREATE INDEX "_contact_v_version_seo_version_seo_social_image_idx" ON "_contact_v" USING btree ("version_seo_social_image_id");
  CREATE INDEX "_contact_v_version_version__status_idx" ON "_contact_v" USING btree ("version__status");
  CREATE INDEX "_contact_v_created_at_idx" ON "_contact_v" USING btree ("created_at");
  CREATE INDEX "_contact_v_updated_at_idx" ON "_contact_v" USING btree ("updated_at");
  CREATE INDEX "_contact_v_latest_idx" ON "_contact_v" USING btree ("latest");
  CREATE INDEX "collection_page_visible_filters_order_idx" ON "collection_page_visible_filters" USING btree ("order");
  CREATE INDEX "collection_page_visible_filters_parent_idx" ON "collection_page_visible_filters" USING btree ("parent_id");
  CREATE INDEX "collection_page_seo_seo_social_image_idx" ON "collection_page" USING btree ("seo_social_image_id");
  CREATE INDEX "collection_page__status_idx" ON "collection_page" USING btree ("_status");
  CREATE INDEX "_collection_page_v_version_visible_filters_order_idx" ON "_collection_page_v_version_visible_filters" USING btree ("order");
  CREATE INDEX "_collection_page_v_version_visible_filters_parent_idx" ON "_collection_page_v_version_visible_filters" USING btree ("parent_id");
  CREATE INDEX "_collection_page_v_version_seo_version_seo_social_image_idx" ON "_collection_page_v" USING btree ("version_seo_social_image_id");
  CREATE INDEX "_collection_page_v_version_version__status_idx" ON "_collection_page_v" USING btree ("version__status");
  CREATE INDEX "_collection_page_v_created_at_idx" ON "_collection_page_v" USING btree ("created_at");
  CREATE INDEX "_collection_page_v_updated_at_idx" ON "_collection_page_v" USING btree ("updated_at");
  CREATE INDEX "_collection_page_v_latest_idx" ON "_collection_page_v" USING btree ("latest");
  CREATE INDEX "navigation_main_links_order_idx" ON "navigation_main_links" USING btree ("_order");
  CREATE INDEX "navigation_main_links_parent_id_idx" ON "navigation_main_links" USING btree ("_parent_id");
  CREATE INDEX "navigation_utility_links_order_idx" ON "navigation_utility_links" USING btree ("_order");
  CREATE INDEX "navigation_utility_links_parent_id_idx" ON "navigation_utility_links" USING btree ("_parent_id");
  CREATE INDEX "navigation__status_idx" ON "navigation" USING btree ("_status");
  CREATE INDEX "navigation_rels_order_idx" ON "navigation_rels" USING btree ("order");
  CREATE INDEX "navigation_rels_parent_idx" ON "navigation_rels" USING btree ("parent_id");
  CREATE INDEX "navigation_rels_path_idx" ON "navigation_rels" USING btree ("path");
  CREATE INDEX "navigation_rels_categories_id_idx" ON "navigation_rels" USING btree ("categories_id");
  CREATE INDEX "_navigation_v_version_main_links_order_idx" ON "_navigation_v_version_main_links" USING btree ("_order");
  CREATE INDEX "_navigation_v_version_main_links_parent_id_idx" ON "_navigation_v_version_main_links" USING btree ("_parent_id");
  CREATE INDEX "_navigation_v_version_utility_links_order_idx" ON "_navigation_v_version_utility_links" USING btree ("_order");
  CREATE INDEX "_navigation_v_version_utility_links_parent_id_idx" ON "_navigation_v_version_utility_links" USING btree ("_parent_id");
  CREATE INDEX "_navigation_v_version_version__status_idx" ON "_navigation_v" USING btree ("version__status");
  CREATE INDEX "_navigation_v_created_at_idx" ON "_navigation_v" USING btree ("created_at");
  CREATE INDEX "_navigation_v_updated_at_idx" ON "_navigation_v" USING btree ("updated_at");
  CREATE INDEX "_navigation_v_latest_idx" ON "_navigation_v" USING btree ("latest");
  CREATE INDEX "_navigation_v_rels_order_idx" ON "_navigation_v_rels" USING btree ("order");
  CREATE INDEX "_navigation_v_rels_parent_idx" ON "_navigation_v_rels" USING btree ("parent_id");
  CREATE INDEX "_navigation_v_rels_path_idx" ON "_navigation_v_rels" USING btree ("path");
  CREATE INDEX "_navigation_v_rels_categories_id_idx" ON "_navigation_v_rels" USING btree ("categories_id");
  CREATE INDEX "site_settings_official_channels_order_idx" ON "site_settings_official_channels" USING btree ("_order");
  CREATE INDEX "site_settings_official_channels_parent_id_idx" ON "site_settings_official_channels" USING btree ("_parent_id");
  CREATE INDEX "_site_settings_v_version_official_channels_order_idx" ON "_site_settings_v_version_official_channels" USING btree ("_order");
  CREATE INDEX "_site_settings_v_version_official_channels_parent_id_idx" ON "_site_settings_v_version_official_channels" USING btree ("_parent_id");
  CREATE INDEX "_site_settings_v_created_at_idx" ON "_site_settings_v" USING btree ("created_at");
  CREATE INDEX "_site_settings_v_updated_at_idx" ON "_site_settings_v" USING btree ("updated_at");
  CREATE INDEX "after_sales_automation_rels_order_idx" ON "after_sales_automation_rels" USING btree ("order");
  CREATE INDEX "after_sales_automation_rels_parent_idx" ON "after_sales_automation_rels" USING btree ("parent_id");
  CREATE INDEX "after_sales_automation_rels_path_idx" ON "after_sales_automation_rels" USING btree ("path");
  CREATE INDEX "after_sales_automation_rels_products_id_idx" ON "after_sales_automation_rels" USING btree ("products_id");
  CREATE INDEX "after_sales_automation_rels_categories_id_idx" ON "after_sales_automation_rels" USING btree ("categories_id");
  CREATE INDEX "_after_sales_automation_v_created_at_idx" ON "_after_sales_automation_v" USING btree ("created_at");
  CREATE INDEX "_after_sales_automation_v_updated_at_idx" ON "_after_sales_automation_v" USING btree ("updated_at");
  CREATE INDEX "_after_sales_automation_v_rels_order_idx" ON "_after_sales_automation_v_rels" USING btree ("order");
  CREATE INDEX "_after_sales_automation_v_rels_parent_idx" ON "_after_sales_automation_v_rels" USING btree ("parent_id");
  CREATE INDEX "_after_sales_automation_v_rels_path_idx" ON "_after_sales_automation_v_rels" USING btree ("path");
  CREATE INDEX "_after_sales_automation_v_rels_products_id_idx" ON "_after_sales_automation_v_rels" USING btree ("products_id");
  CREATE INDEX "_after_sales_automation_v_rels_categories_id_idx" ON "_after_sales_automation_v_rels" USING btree ("categories_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "report_export_files" CASCADE;
  DROP TABLE "categories_search_terms" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "_categories_v_version_search_terms" CASCADE;
  DROP TABLE "_categories_v" CASCADE;
  DROP TABLE "products_attributes" CASCADE;
  DROP TABLE "products_gallery" CASCADE;
  DROP TABLE "products_option_definitions_values" CASCADE;
  DROP TABLE "products_option_definitions" CASCADE;
  DROP TABLE "products_variants_selection" CASCADE;
  DROP TABLE "products_variants_media_keys" CASCADE;
  DROP TABLE "products_variants" CASCADE;
  DROP TABLE "products_search_terms" CASCADE;
  DROP TABLE "products_tags" CASCADE;
  DROP TABLE "products_publication_issues" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "_products_v_version_attributes" CASCADE;
  DROP TABLE "_products_v_version_gallery" CASCADE;
  DROP TABLE "_products_v_version_option_definitions_values" CASCADE;
  DROP TABLE "_products_v_version_option_definitions" CASCADE;
  DROP TABLE "_products_v_version_variants_selection" CASCADE;
  DROP TABLE "_products_v_version_variants_media_keys" CASCADE;
  DROP TABLE "_products_v_version_variants" CASCADE;
  DROP TABLE "_products_v_version_search_terms" CASCADE;
  DROP TABLE "_products_v_version_tags" CASCADE;
  DROP TABLE "_products_v_version_publication_issues" CASCADE;
  DROP TABLE "_products_v" CASCADE;
  DROP TABLE "_products_v_rels" CASCADE;
  DROP TABLE "leads" CASCADE;
  DROP TABLE "leads_rels" CASCADE;
  DROP TABLE "_leads_v" CASCADE;
  DROP TABLE "_leads_v_rels" CASCADE;
  DROP TABLE "customers_interest_profile_materials" CASCADE;
  DROP TABLE "customers_preferences" CASCADE;
  DROP TABLE "customers_tags" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "customers_rels" CASCADE;
  DROP TABLE "_customers_v_version_interest_profile_materials" CASCADE;
  DROP TABLE "_customers_v_version_preferences" CASCADE;
  DROP TABLE "_customers_v_version_tags" CASCADE;
  DROP TABLE "_customers_v" CASCADE;
  DROP TABLE "_customers_v_rels" CASCADE;
  DROP TABLE "client_interests" CASCADE;
  DROP TABLE "_client_interests_v" CASCADE;
  DROP TABLE "opportunities" CASCADE;
  DROP TABLE "opportunities_rels" CASCADE;
  DROP TABLE "_opportunities_v" CASCADE;
  DROP TABLE "_opportunities_v_rels" CASCADE;
  DROP TABLE "sales_items" CASCADE;
  DROP TABLE "sales" CASCADE;
  DROP TABLE "_sales_v_version_items" CASCADE;
  DROP TABLE "_sales_v" CASCADE;
  DROP TABLE "after_sales_follow_ups" CASCADE;
  DROP TABLE "after_sales" CASCADE;
  DROP TABLE "_after_sales_v_version_follow_ups" CASCADE;
  DROP TABLE "_after_sales_v" CASCADE;
  DROP TABLE "tasks" CASCADE;
  DROP TABLE "tasks_rels" CASCADE;
  DROP TABLE "_tasks_v" CASCADE;
  DROP TABLE "_tasks_v_rels" CASCADE;
  DROP TABLE "shipments" CASCADE;
  DROP TABLE "_shipments_v" CASCADE;
  DROP TABLE "occurrences" CASCADE;
  DROP TABLE "_occurrences_v" CASCADE;
  DROP TABLE "activities" CASCADE;
  DROP TABLE "activities_rels" CASCADE;
  DROP TABLE "report_exports" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "home_hero_slides" CASCADE;
  DROP TABLE "home_matter_panels" CASCADE;
  DROP TABLE "home_signature_slides" CASCADE;
  DROP TABLE "home_provenance_steps" CASCADE;
  DROP TABLE "home" CASCADE;
  DROP TABLE "home_rels" CASCADE;
  DROP TABLE "_home_v_version_hero_slides" CASCADE;
  DROP TABLE "_home_v_version_matter_panels" CASCADE;
  DROP TABLE "_home_v_version_signature_slides" CASCADE;
  DROP TABLE "_home_v_version_provenance_steps" CASCADE;
  DROP TABLE "_home_v" CASCADE;
  DROP TABLE "_home_v_rels" CASCADE;
  DROP TABLE "about" CASCADE;
  DROP TABLE "_about_v" CASCADE;
  DROP TABLE "contact_channels" CASCADE;
  DROP TABLE "contact" CASCADE;
  DROP TABLE "_contact_v_version_channels" CASCADE;
  DROP TABLE "_contact_v" CASCADE;
  DROP TABLE "collection_page_visible_filters" CASCADE;
  DROP TABLE "collection_page" CASCADE;
  DROP TABLE "_collection_page_v_version_visible_filters" CASCADE;
  DROP TABLE "_collection_page_v" CASCADE;
  DROP TABLE "navigation_main_links" CASCADE;
  DROP TABLE "navigation_utility_links" CASCADE;
  DROP TABLE "navigation" CASCADE;
  DROP TABLE "navigation_rels" CASCADE;
  DROP TABLE "_navigation_v_version_main_links" CASCADE;
  DROP TABLE "_navigation_v_version_utility_links" CASCADE;
  DROP TABLE "_navigation_v" CASCADE;
  DROP TABLE "_navigation_v_rels" CASCADE;
  DROP TABLE "site_settings_official_channels" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "_site_settings_v_version_official_channels" CASCADE;
  DROP TABLE "_site_settings_v" CASCADE;
  DROP TABLE "after_sales_automation" CASCADE;
  DROP TABLE "after_sales_automation_rels" CASCADE;
  DROP TABLE "_after_sales_automation_v" CASCADE;
  DROP TABLE "_after_sales_automation_v_rels" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."category_state";
  DROP TYPE "public"."enum_categories_status";
  DROP TYPE "public"."enum__categories_v_version_status";
  DROP TYPE "public"."enum_products_gallery_role";
  DROP TYPE "public"."enum_products_variants_price_mode";
  DROP TYPE "public"."enum_products_variants_status";
  DROP TYPE "public"."enum_products_catalog_status";
  DROP TYPE "public"."enum_products_availability";
  DROP TYPE "public"."enum_products_price_mode";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum__products_v_version_gallery_role";
  DROP TYPE "public"."enum__products_v_version_variants_price_mode";
  DROP TYPE "public"."enum__products_v_version_variants_status";
  DROP TYPE "public"."enum__products_v_version_catalog_status";
  DROP TYPE "public"."enum__products_v_version_availability";
  DROP TYPE "public"."enum__products_v_version_price_mode";
  DROP TYPE "public"."enum__products_v_version_status";
  DROP TYPE "public"."enum_leads_source";
  DROP TYPE "public"."enum_leads_stage";
  DROP TYPE "public"."enum__leads_v_version_source";
  DROP TYPE "public"."enum__leads_v_version_stage";
  DROP TYPE "public"."enum_customers_status";
  DROP TYPE "public"."enum_customers_origin";
  DROP TYPE "public"."enum_customers_privacy_request_status";
  DROP TYPE "public"."enum__customers_v_version_status";
  DROP TYPE "public"."enum__customers_v_version_origin";
  DROP TYPE "public"."enum__customers_v_version_privacy_request_status";
  DROP TYPE "public"."enum_client_interests_status";
  DROP TYPE "public"."enum_client_interests_source";
  DROP TYPE "public"."enum__client_interests_v_version_status";
  DROP TYPE "public"."enum__client_interests_v_version_source";
  DROP TYPE "public"."enum_opportunities_source";
  DROP TYPE "public"."enum_opportunities_stage";
  DROP TYPE "public"."enum_opportunities_priority";
  DROP TYPE "public"."enum_opportunities_loss_reason";
  DROP TYPE "public"."enum__opportunities_v_version_source";
  DROP TYPE "public"."enum__opportunities_v_version_stage";
  DROP TYPE "public"."enum__opportunities_v_version_priority";
  DROP TYPE "public"."enum__opportunities_v_version_loss_reason";
  DROP TYPE "public"."enum_sales_items_price_mode";
  DROP TYPE "public"."enum_sales_channel";
  DROP TYPE "public"."enum_sales_status";
  DROP TYPE "public"."enum_sales_delivery_mode";
  DROP TYPE "public"."enum__sales_v_version_items_price_mode";
  DROP TYPE "public"."enum__sales_v_version_channel";
  DROP TYPE "public"."enum__sales_v_version_status";
  DROP TYPE "public"."enum__sales_v_version_delivery_mode";
  DROP TYPE "public"."enum_after_sales_follow_ups_moment";
  DROP TYPE "public"."enum_after_sales_follow_ups_purpose";
  DROP TYPE "public"."enum_after_sales_follow_ups_status";
  DROP TYPE "public"."enum_after_sales_status";
  DROP TYPE "public"."enum_after_sales_priority";
  DROP TYPE "public"."enum_after_sales_incident_type";
  DROP TYPE "public"."enum__after_sales_v_version_follow_ups_moment";
  DROP TYPE "public"."enum__after_sales_v_version_follow_ups_purpose";
  DROP TYPE "public"."enum__after_sales_v_version_follow_ups_status";
  DROP TYPE "public"."enum__after_sales_v_version_status";
  DROP TYPE "public"."enum__after_sales_v_version_priority";
  DROP TYPE "public"."enum__after_sales_v_version_incident_type";
  DROP TYPE "public"."enum_tasks_type";
  DROP TYPE "public"."enum_tasks_status";
  DROP TYPE "public"."enum_tasks_priority";
  DROP TYPE "public"."enum__tasks_v_version_type";
  DROP TYPE "public"."enum__tasks_v_version_status";
  DROP TYPE "public"."enum__tasks_v_version_priority";
  DROP TYPE "public"."enum_shipments_status";
  DROP TYPE "public"."enum__shipments_v_version_status";
  DROP TYPE "public"."enum_occurrences_type";
  DROP TYPE "public"."enum_occurrences_severity";
  DROP TYPE "public"."enum_occurrences_status";
  DROP TYPE "public"."enum__occurrences_v_version_type";
  DROP TYPE "public"."enum__occurrences_v_version_severity";
  DROP TYPE "public"."enum__occurrences_v_version_status";
  DROP TYPE "public"."enum_activities_event_type";
  DROP TYPE "public"."enum_activities_kind";
  DROP TYPE "public"."enum_activities_from_stage";
  DROP TYPE "public"."enum_activities_to_stage";
  DROP TYPE "public"."enum_activities_loss_reason";
  DROP TYPE "public"."enum_report_exports_status";
  DROP TYPE "public"."enum_report_exports_delivery";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."dest_type";
  DROP TYPE "public"."enum_home_hero_mode";
  DROP TYPE "public"."enum_home_status";
  DROP TYPE "public"."enum__home_v_version_hero_mode";
  DROP TYPE "public"."enum__home_v_version_status";
  DROP TYPE "public"."enum_about_status";
  DROP TYPE "public"."enum__about_v_version_status";
  DROP TYPE "public"."enum_contact_channels_kind";
  DROP TYPE "public"."enum_contact_status";
  DROP TYPE "public"."enum__contact_v_version_channels_kind";
  DROP TYPE "public"."enum__contact_v_version_status";
  DROP TYPE "public"."enum_collection_page_visible_filters";
  DROP TYPE "public"."enum_collection_page_status";
  DROP TYPE "public"."enum__collection_page_v_version_visible_filters";
  DROP TYPE "public"."enum__collection_page_v_version_status";
  DROP TYPE "public"."enum_navigation_status";
  DROP TYPE "public"."enum__navigation_v_version_status";
  DROP TYPE "public"."enum_site_settings_official_channels_kind";
  DROP TYPE "public"."enum__site_settings_v_version_official_channels_kind";
  DROP TYPE "public"."enum_after_sales_automation_maintenance_scope";
  DROP TYPE "public"."enum__after_sales_automation_v_version_maintenance_scope";`)
}
