-- UNDERNET PRO: lista funkcji objętych abonamentem plus znacznik na koncie.
--
-- Sama lista mieszka w bazie, nie w kodzie: to decyzja handlowa, która ma
-- dać się zmienić z panelu bez wdrożenia. `requires_premium` domyślnie
-- FAŁSZ — po tej migracji nic nie przestaje działać nikomu.

CREATE TABLE IF NOT EXISTS "premium_features" (
    "id"               SERIAL       PRIMARY KEY,
    "key"              TEXT         NOT NULL,
    "name"             TEXT         NOT NULL,
    "description"      TEXT,
    "position"         INTEGER      NOT NULL DEFAULT 0,
    "requires_premium" BOOLEAN      NOT NULL DEFAULT false,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "premium_features_key_key" ON "premium_features"("key");
CREATE INDEX IF NOT EXISTS "premium_features_position_idx" ON "premium_features"("position");

-- Znacznik wykupionego PRO. Bez niego przełączniki byłyby ozdobą: funkcja
-- oznaczona jako płatna byłaby niedostępna dla wszystkich, bo nikt nie
-- mógłby jej mieć.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_pro"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pro_until" TIMESTAMP(3);
