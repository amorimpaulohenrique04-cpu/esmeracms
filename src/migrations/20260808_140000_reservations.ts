import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * PR5 — Reservas transacionais.
 *
 * Em desenvolvimento o `push` do adapter cria a tabela automaticamente; esta
 * migração cobre produção. O diferencial que o config do Payload não expressa é
 * o ÍNDICE ÚNICO PARCIAL sobre (product_id) WHERE unique_piece AND status ativo:
 * ele é a garantia de que só existe UMA reserva ativa por peça única, mesmo sob
 * concorrência (a transação perdedora aborta no commit).
 *
 * Convenções (tipos, timestamps, nomes de índice) seguem as migrações do repo.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_reservations_status" AS ENUM('held', 'confirmed', 'released', 'expired');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "reservations" (
      "id" serial PRIMARY KEY NOT NULL,
      "product_id" numeric NOT NULL,
      "product_slug" varchar NOT NULL,
      "variant_sku" varchar,
      "unique_piece" boolean DEFAULT false,
      "status" "enum_reservations_status" DEFAULT 'held' NOT NULL,
      "idempotency_key" varchar NOT NULL,
      "reserved_until" timestamp(3) with time zone,
      "price_cents" numeric,
      "buyer_ref" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "reservations_idempotency_key_idx" ON "reservations" USING btree ("idempotency_key");
    CREATE INDEX IF NOT EXISTS "reservations_product_id_idx" ON "reservations" USING btree ("product_id");
    CREATE INDEX IF NOT EXISTS "reservations_unique_piece_idx" ON "reservations" USING btree ("unique_piece");
    CREATE INDEX IF NOT EXISTS "reservations_status_idx" ON "reservations" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "reservations_updated_at_idx" ON "reservations" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "reservations_created_at_idx" ON "reservations" USING btree ("created_at");

    -- Atomicidade da peça única: no máximo UMA reserva ativa por produto único.
    CREATE UNIQUE INDEX IF NOT EXISTS "reservations_unique_active_piece_idx"
      ON "reservations" USING btree ("product_id")
      WHERE "unique_piece" = true AND "status" IN ('held', 'confirmed');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "reservations";
    DROP TYPE IF EXISTS "public"."enum_reservations_status";
  `)
}
