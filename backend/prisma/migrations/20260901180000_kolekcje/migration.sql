-- Kolekcje: nazwane zbiory zapisanych rzeczy.
--
-- Zakładki (`follows.post_id`) zostają nietknięte i darmowe — to płaska
-- lista „zapisane", która działa od dawna. Kolekcje są warstwą wyżej.

CREATE TABLE IF NOT EXISTS "collections" (
    "id"          SERIAL       PRIMARY KEY,
    "user_id"     INTEGER      NOT NULL,
    "name"        TEXT         NOT NULL,
    "description" TEXT,
    "position"    INTEGER      NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id")
      REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Dwie kolekcje o tej samej nazwie u jednego użytkownika to pomyłka:
-- na liście nie da się ich potem odróżnić.
CREATE UNIQUE INDEX IF NOT EXISTS "collections_user_id_name_key" ON "collections"("user_id", "name");
CREATE INDEX IF NOT EXISTS "collections_user_id_position_idx" ON "collections"("user_id", "position");

CREATE TABLE IF NOT EXISTS "collection_items" (
    "id"              SERIAL       PRIMARY KEY,
    "collection_id"   INTEGER      NOT NULL,
    "post_id"         INTEGER,
    "content_item_id" INTEGER,
    "note"            TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id")
      REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "collection_items_post_id_fkey" FOREIGN KEY ("post_id")
      REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "collection_items_content_item_id_fkey" FOREIGN KEY ("content_item_id")
      REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Ta sama rzecz dwa razy w jednej kolekcji nie ma sensu.
CREATE UNIQUE INDEX IF NOT EXISTS "collection_items_collection_id_post_id_key"
  ON "collection_items"("collection_id", "post_id");
CREATE UNIQUE INDEX IF NOT EXISTS "collection_items_collection_id_content_item_id_key"
  ON "collection_items"("collection_id", "content_item_id");
CREATE INDEX IF NOT EXISTS "collection_items_collection_id_created_at_idx"
  ON "collection_items"("collection_id", "created_at");
