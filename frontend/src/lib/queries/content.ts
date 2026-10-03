'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { News } from '@/lib/types';
import { queryKeys, type FeedFilters } from './keys';
import { DEFAULT_LIMIT, communitiesQuery, feedQuery, tagsByTypeQuery, type Paged } from './feed-query';

// Re-exported so consumers have a single import site for the data layer.
export { feedQuery, communitiesQuery, tagsByTypeQuery, DEFAULT_LIMIT };
export type { Paged };
export type { FeedItem } from './feed-query';

/** Infinite feed for the Content Wall. */
export function useFeed(filters: FeedFilters = {}, limit = DEFAULT_LIMIT) {
  return useInfiniteQuery(feedQuery(filters, limit));
}



/**
 * Batch-hydrate reactions and the current user's votes for a set of posts.
 *
 * Kept as one hook because the wall always needs both together, and both are
 * single round trips regardless of how many cards are on screen.
 */
export function usePostInteractions(ids: number[], enabled = true) {
  const sorted = [...ids].sort((a, b) => a - b);
  const idParam = sorted.join(',');

  const reactions = useQuery({
    queryKey: queryKeys.post.reactions(sorted),
    queryFn: async () => {
      const { data } = await api.get(`/posts/reactions/batch?ids=${idParam}`);
      return data as Record<number, { emoji: string; count: number; reacted: boolean }[]>;
    },
    enabled: enabled && sorted.length > 0,
    staleTime: 30_000,
  });

  const votes = useQuery({
    queryKey: queryKeys.post.votes(sorted),
    queryFn: async () => {
      const { data } = await api.get(`/posts/user-votes/batch?ids=${idParam}`);
      return data as Record<number, 'UP' | 'DOWN'>;
    },
    enabled: enabled && sorted.length > 0,
    staleTime: 30_000,
  });

  return { reactions, votes };
}

// ─── Discover ───────────────────────────────────────────────────────────────

/** Tags of one domain type, e.g. every GAME. */
export function useTagsByType(type: 'GAME' | 'CATEGORY' | 'LANGUAGE' | 'FORMAT' | 'TOPIC') {
  return useQuery(tagsByTypeQuery(type));
}


/** All communities. */
export function useCommunities() {
  return useQuery(communitiesQuery());
}





