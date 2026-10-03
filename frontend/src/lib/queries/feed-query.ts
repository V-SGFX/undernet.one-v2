import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { News, Post } from '@/lib/types';
import { queryKeys, type FeedFilters } from './keys';

/**
 * Query definitions shared by the server and the client.
 *
 * Deliberately has no 'use client' directive. The hooks in content.ts do, and
 * anything exported from that module is a client reference — calling it from a
 * server component fails with "Attempted to call feedQuery() from the server
 * but feedQuery is on the client". Keeping the options object here is what
 * lets a route prefetch exactly the query the wall will mount.
 */

/** Envelope returned by /feed and /posts. */
export interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total?: number; pages?: number; hasMore?: boolean };
}

/**
 * A feed row. The scorer in FeedService attaches its ranking metadata to each
 * post; `_reason` is the human-readable explanation of why it was boosted.
 */
export type FeedItem = Post & {
  _score?: number;
  _globalScore?: number;
  _personalScore?: number;
  _reason?: string | null;
};

export type { News };

export const DEFAULT_LIMIT = 24;

/** Translate FeedFilters into the query params the existing API expects. */
function toParams(filters: FeedFilters, page: number, limit: number): string {
  const p = new URLSearchParams();
  p.set('page', String(page));
  p.set('limit', String(limit));

  /*
   * Zakładka „Najnowsze" nie wysyłała NICZEGO.
   *
   * Mapowany był wyłącznie tryb `trending`, więc wybór „Najnowsze" dawał
   * dokładnie ten sam kanał co „Gorące" — a świeży wpis bez głosów siedzi
   * w tamtym rankingu na końcu. Stąd wrażenie, że nowy wpis „nie pokazuje
   * się wcale", dopóki nie przełączy się na sortowanie po ocenach.
   */
  if (filters.mode === 'trending') p.set('sort', 'top');
  if (filters.mode === 'new') p.set('sort', 'new');
  if (filters.mode === 'following') p.set('following', 'true');
  if (filters.type) p.set('type', filters.type);
  if (filters.community) p.set('community', filters.community);

  // Game and language are both tag slugs. The current /feed endpoint accepts a
  // single `tag` param, so only one can be applied server-side today.
  if (filters.game) p.set('tag', filters.game);
  else if (filters.language) p.set('tag', filters.language);

  return p.toString();
}

async function fetchFeedPage(
  filters: FeedFilters,
  page: number,
  limit: number,
): Promise<Paged<FeedItem>> {
  const { data } = await api.get(`/feed?${toParams(filters, page, limit)}`);
  return data;
}

/** Did the server indicate more pages? Handles both meta shapes in use. */
function nextPageParam(last: Paged<FeedItem>): number | undefined {
  if (!last?.data?.length) return undefined;
  const page = Number(last.meta?.page ?? 1);
  if (typeof last.meta?.hasMore === 'boolean') return last.meta.hasMore ? page + 1 : undefined;
  const pages = Number(last.meta?.pages ?? page);
  return page < pages ? page + 1 : undefined;
}

/**
 * Shared options so a route can prefetch the same query the wall mounts:
 *   await queryClient.prefetchInfiniteQuery(feedQuery(filters))
 */
export function feedQuery(filters: FeedFilters = {}, limit = DEFAULT_LIMIT) {
  return infiniteQueryOptions({
    // `limit` belongs in the key: two walls reading the same filters at
    // different page sizes are different caches.
    queryKey: queryKeys.feed.list({ ...filters, limit }),
    queryFn: ({ pageParam }) => fetchFeedPage(filters, pageParam, limit),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    // Feed responses are Redis-cached server-side; don't refetch faster.
    staleTime: 60_000,
  });
}



/**
 * Tags of one domain type. Shared with the server so Discover can render its
 * directory in the HTML rather than as a grid of placeholders.
 */
export function tagsByTypeQuery(type: 'GAME' | 'CATEGORY' | 'LANGUAGE' | 'FORMAT' | 'TOPIC') {
  return queryOptions({
    queryKey: queryKeys.tags.byType(type),
    queryFn: async () => {
      const { data } = await api.get(`/tags?type=${type}`);
      return data as { id: number; name: string; slug: string; postCount: number }[];
    },
    staleTime: 10 * 60_000,
  });
}


/**
 * Lista społeczności.
 *
 * Mieszkała w content.ts, który jest modułem klienckim — a strona główna
 * musi pobrać ją po stronie serwera. Import z 'use client' do komponentu
 * serwerowego nie przechodzi, więc zapytanie stoi tutaj.
 */
export function communitiesQuery() {
  return queryOptions({
    queryKey: queryKeys.community.list(),
    queryFn: async () => {
      const { data } = await api.get('/communities');
      return data as {
        id: number; name: string; slug: string; description: string | null;
        color: string | null; iconUrl: string | null; postCount: number; memberCount: number;
        /** Grupa nadrzędna; puste = dział najwyższego poziomu. */
        parentId: number | null;
        position: number;
        /** Wątki własne, bez podkategorii — rozstrzyga o indeksowaniu. */
        postCountWlasny?: number;
      }[];
    },
    staleTime: 10 * 60_000,
  });
}
