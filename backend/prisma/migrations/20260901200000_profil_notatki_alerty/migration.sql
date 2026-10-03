-- Rozszerzony profil, prywatne notatki i alerty — trzy funkcje UNDERNET PRO.

-- ── Profil ───────────────────────────────────────────────────────────
-- Pola są niewinne; płatna jest MOŻLIWOŚĆ ICH USTAWIENIA, nie odczyt.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio"        TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "website"    TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location"   TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "banner_url" TEXT;

-- ── Powiadomienia: dwa nowe rodzaje ──────────────────────────────────
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ALERT_MATCH';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TOPIC_DIGEST';

-- ── Prywatne notatki ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "private_notes" (
    "id"              SERIAL       PRIMARY KEY,
    "user_id"         INTEGER      NOT NULL,
    "post_id"         INTEGER,
    "content_item_id" INTEGER,
    "body"            TEXT         NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "private_notes_user_id_fkey" FOREIGN KEY ("user_id")
      REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "private_notes_post_id_fkey" FOREIGN KEY ("post_id")
      REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "private_notes_content_item_id_fkey" FOREIGN KEY ("content_item_id")
      REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Jedna notatka na rzecz: druga do tego samego wątku to rozdwojenie tej
-- samej myśli, nie kolejna.
CREATE UNIQUE INDEX IF NOT EXISTS "private_notes_user_id_post_id_key"
  ON "private_notes"("user_id", "post_id");
CREATE UNIQUE INDEX IF NOT EXISTS "private_notes_user_id_content_item_id_key"
  ON "private_notes"("user_id", "content_item_id");
CREATE INDEX IF NOT EXISTS "private_notes_user_id_updated_at_idx"
  ON "private_notes"("user_id", "updated_at");

-- ── Alerty ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "AlertScope" AS ENUM ('POSTS', 'CONTENT', 'BOTH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "alerts" (
    "id"           SERIAL       PRIMARY KEY,
    "user_id"      INTEGER      NOT NULL,
    "phrase"       TEXT         NOT NULL,
    "scope"        "AlertScope" NOT NULL DEFAULT 'BOTH',
    "is_active"    BOOLEAN      NOT NULL DEFAULT true,
    -- Dokąd doszliśmy: bez tego każdy cykl przeglądałby całe archiwum
    -- i powiadamiał drugi raz o tym samym.
    "last_post_id" INTEGER      NOT NULL DEFAULT 0,
    "last_item_id" INTEGER      NOT NULL DEFAULT 0,
    "hit_count"    INTEGER      NOT NULL DEFAULT 0,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id")
      REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "alerts_user_id_phrase_key" ON "alerts"("user_id", "phrase");
CREATE INDEX IF NOT EXISTS "alerts_is_active_idx" ON "alerts"("is_active");
