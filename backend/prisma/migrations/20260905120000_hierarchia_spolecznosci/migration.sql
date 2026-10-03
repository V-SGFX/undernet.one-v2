-- Hierarchia społeczności: grupa nadrzędna i kolejność w grupie.
--
-- Obie kolumny są opcjonalne albo mają wartość domyślną, więc istniejące
-- społeczności zostają nietknięte jako działy najwyższego poziomu.
-- Żaden wątek nie zmienia przypisania.
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "parent_id" INTEGER;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "position"  INTEGER NOT NULL DEFAULT 0;

-- SET NULL, nie CASCADE: usunięcie grupy ma odpiąć podkategorie do korzenia,
-- a nie skasować ich razem z wątkami, które w nich leżą.
DO $$ BEGIN
  ALTER TABLE "communities"
    ADD CONSTRAINT "communities_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "communities"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "communities_parent_id_position_idx"
  ON "communities"("parent_id", "position");
