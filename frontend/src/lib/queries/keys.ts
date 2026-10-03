/**
 * Query key factory.
 *
 * Every cache key in the app is built here so that invalidation stays
 * predictable. Keys are hierarchical: invalidating `queryKeys.feed.all`
 * drops every feed variant, invalidating `queryKeys.all` drops everything.
 *
 * Rule: never inline a raw array key at a call site.
 */

export type FeedMode = 'for-you' | 'following' | 'trending' | 'new';

export interface FeedFilters {
  /** Feed tab. Maps to different endpoints / sort params. */
  mode?: FeedMode;
  /** Tag slug of type GAME. */
  game?: string;
  /** Tag slug of type LANGUAGE. Undefined = no language filter. */
  language?: string;
  /** Post type filter, e.g. 'CLIP'. */
  type?: string;
  /** Community slug. */
  community?: string;
  /** Page size. Two walls on the same filters but different page sizes are
   *  genuinely different caches, so this participates in the key. */
  limit?: number;
}

/** Stable key fragment — undefined/empty entries are dropped so that
 *  {game: undefined} and {} produce the same cache key. */
function normalize(filters: FeedFilters = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v);
  }
  return out;
}

export const queryKeys = {
  all: ['undernet'] as const,

  feed: {
    all: ['undernet', 'feed'] as const,
    list: (filters: FeedFilters = {}) => ['undernet', 'feed', 'list', normalize(filters)] as const,
  },

  clips: {
    all: ['undernet', 'clips'] as const,
    list: (filters: FeedFilters = {}) => ['undernet', 'clips', 'list', normalize(filters)] as const,
  },


  news: {
    all: ['undernet', 'news'] as const,
    list: (filters: { limit?: number } = {}) =>
      ['undernet', 'news', 'list', normalize(filters as FeedFilters)] as const,
  },

  post: {
    all: ['undernet', 'post'] as const,
    detail: (id: number) => ['undernet', 'post', id] as const,
    /** Batch-hydrated interaction state, keyed by the id set it covers. */
    reactions: (ids: number[]) => ['undernet', 'post', 'reactions', [...ids].sort((a, b) => a - b)] as const,
    votes: (ids: number[]) => ['undernet', 'post', 'votes', [...ids].sort((a, b) => a - b)] as const,
  },


  community: {
    all: ['undernet', 'community'] as const,
    list: () => ['undernet', 'community', 'list'] as const,
    detail: (slug: string) => ['undernet', 'community', slug] as const,
  },

  tags: {
    all: ['undernet', 'tags'] as const,
    /** Tags filtered by domain type — GAME, LANGUAGE, CATEGORY, ... */
    byType: (type: string) => ['undernet', 'tags', 'type', type] as const,
  },

  search: {
    all: ['undernet', 'search'] as const,
    query: (q: string) => ['undernet', 'search', q] as const,
  },
} as const;
