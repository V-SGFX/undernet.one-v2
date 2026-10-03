-- Przełączniki serwisu. Na razie jeden: czy w ogóle pokazujemy UNDERNET PRO.
CREATE TABLE IF NOT EXISTS "site_settings" (
    "id"          SERIAL       PRIMARY KEY,
    "key"         TEXT         NOT NULL,
    "label"       TEXT         NOT NULL,
    "description" TEXT,
    "enabled"     BOOLEAN      NOT NULL DEFAULT true,
    "updated_at"  TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "site_settings_key_key" ON "site_settings"("key");

-- Zakładamy WYŁĄCZONY: dziś PRO ma być schowane.
INSERT INTO "site_settings" ("key", "label", "description", "enabled", "updated_at")
VALUES (
  'pro-visible',
  'Pokazuj UNDERNET PRO',
  'Wyłączone chowa przycisk PRO w pasku i zamyka stronę /pro. Nie zmienia dostępu do funkcji — tym sterują przełączniki wyżej.',
  false,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
