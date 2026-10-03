'use client';

import { useMemo } from 'react';
import { useFeed } from '@/lib/queries/content';
import type { FeedFilters } from '@/lib/queries/keys';
import { toContentItem, type ContentItem } from '@/lib/content/types';
import { ContentWall } from './content-wall';

interface FeedProps {
  filters?: FeedFilters;
  label: string;
  emptyTitle?: string;
  emptyDescription?: string;
  limit?: number;
}

/**
 * Data-connected content wall.
 *
 * Thin by design: it turns queries into the flat item list the wall renders
 * and nothing else. Surfaces needing a different source compose ContentWall
 * directly rather than extending this.
 */
export function Feed({
  filters,
  label,
  emptyTitle,
  emptyDescription,
  limit,
}: FeedProps) {
  const query = useFeed(filters, limit);

  /*
   * Ściana pokazuje wyłącznie wpisy. Wersja z xdtv wplatała tu co siódmy
   * kafelek trwającą transmisję — razem z warstwą streamingu zniknęło
   * i to, i zapytanie, które je pobierało.
   */
  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((page: any) => (page.data ?? []).map(toContentItem)),
    [query.data],
  );

  return (
    <ContentWall
      items={items}
      label={label}
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => query.refetch()}
      onLoadMore={() => query.fetchNextPage()}
      hasMore={Boolean(query.hasNextPage)}
      loadingMore={query.isFetchingNextPage}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    />
  );
}
