import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Completa o vínculo interno que o Payload usa para document locking.
 *
 * A collection `reservations` foi adicionada em 20260808_140000_reservations,
 * mas aquela migration não adicionou `reservations_id` em
 * `payload_locked_documents_rels`. O schema gerado pelo Payload passou a
 * consultar essa coluna no Admin, derrubando /admin em produção com PostgreSQL
 * 42703 (undefined_column).
 *
 * Mantemos a correção em uma migration separada porque a migration original já
 * pode estar registrada como executada em ambientes existentes.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "reservations_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_reservations_fk"
        FOREIGN KEY ("reservations_id") REFERENCES "public"."reservations"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_reservations_id_idx"
      ON "payload_locked_documents_rels" USING btree ("reservations_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_reservations_id_idx";

    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reservations_fk";

    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "reservations_id";
  `)
}
