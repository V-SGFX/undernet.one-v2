-- Ozdoby nicku i awatara. Przechowujemy klucze z zamkniętej listy,
-- nigdy CSS-a od użytkownika.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name_color"  TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name_style"  TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_ring" TEXT;
