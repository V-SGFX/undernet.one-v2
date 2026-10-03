-- Usunięcie kolumn po profilach streamerów.
--
-- Przy kopiowaniu szkieletu xdtv wycięte zostały RELACJE, ale skalary
-- typu `streamer_profile_id` przetrwały. TypeScript ich nie złapał —
-- kolumna istniała, więc kod odwołujący się do nieistniejącej już
-- relacji `streamerProfile` kompilował się i wywracał dopiero w locie:
-- /api/feed i /api/posts zwracały 500, a strona społeczności komunikat
-- „Nie udało się załadować danych".

DROP INDEX IF EXISTS "communities_streamer_profile_id_key";
DROP INDEX IF EXISTS "posts_streamer_profile_id_idx";

ALTER TABLE "communities"      DROP COLUMN IF EXISTS "streamer_profile_id";
ALTER TABLE "posts"            DROP COLUMN IF EXISTS "streamer_profile_id";
ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "viewed_streamer_ids";
