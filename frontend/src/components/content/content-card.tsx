'use client';

import type { ContentItem } from '@/lib/content/types';
import type { TileSpan } from './content-tile';
import { ArticleCard } from './article-card';
import { PostCard } from './post-card';
import {
  ArticleTileSkeleton,
  ContentTileSkeleton,
  PostTileSkeleton,
} from '@/components/ui/skeleton';

/**
 * Single entry point for rendering any piece of content.
 *
 * Każda powierzchnia — start, odkrywaj, społeczności, szukaj, profile —
 * renderuje przez ten jeden punkt. Nic dalej nie rozgałęzia się po rodzaju
 * treści, i to trzyma jeden system kafelków zamiast jednego na ekran.
 */
export function ContentCard({
  item,
  span,
  priority = false,
}: {
  item: ContentItem;
  span?: TileSpan;
  priority?: boolean;
}) {
  switch (item.kind) {
    case 'article':
      return <ArticleCard item={item} span={span ?? 'narrow'} priority={priority} />;
    case 'post':
      return <PostCard item={item} span={span ?? 'narrow'} priority={priority} />;
  }
}

/** Loading placeholder matching the geometry of the kind it stands in for. */
export function ContentCardSkeleton({ kind = 'post' }: { kind?: ContentItem['kind'] }) {
  if (kind === 'article') return <ArticleTileSkeleton />;
  return <PostTileSkeleton />;
}
