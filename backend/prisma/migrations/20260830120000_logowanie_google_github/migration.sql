-- Logowanie kontem zewnętrznym: zostaje Discord, dochodzą Google i GitHub.
--
-- Twitch, Kick, YouTube i TikTok przyszły ze szkieletu xdtv.fans razem
-- z warstwą streamingu. Tej warstwy w undernecie nie ma, więc kolumny
-- niczego nie trzymały — a przyciski, które na nie wskazywały, prowadziły
-- do endpointu, którego ten backend nigdy nie montował.
DROP INDEX IF EXISTS "users_twitch_id_key";
DROP INDEX IF EXISTS "users_kick_id_key";
DROP INDEX IF EXISTS "users_youtube_id_key";
DROP INDEX IF EXISTS "users_tiktok_id_key";

ALTER TABLE "users" DROP COLUMN IF EXISTS "twitch_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "kick_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "youtube_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "tiktok_id";

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_key" ON "users"("google_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_github_id_key" ON "users"("github_id");
