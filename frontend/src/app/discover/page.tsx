import type { Metadata } from 'next';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { contentListQuery, categoriesQuery, TYPE_BY_PATH } from '@/lib/queries/knowledge';
import { DiscoverScreen } from './discover-screen';

type Params = { tab?: string; category?: string; author?: string };

export const metadata: Metadata = {
  title: 'Odkrywaj — wiedza i społeczności',
  description:
    'Przeglądaj wszystko naraz: newsy, artykuły, instrukcje, wiki i społeczności UNDERNET.ONE.',
  alternates: { canonical: 'https://undernet.one/discover' },
  openGraph: {
    title: 'Odkrywaj — wiedza i społeczności',
    description: 'Newsy, artykuły, how-to, wiki i społeczności w jednym miejscu.',
    url: 'https://undernet.one/discover',
  },
};

/**
 * Odkrywaj.
 *
 * Jedna siatka nad wszystkimi czterema typami materiałów plus społeczności
 * i tagi. Wersja odziedziczona po xdtv pobierała tu na serwerze katalog gier
 * (`/tags?type=GAME`) — zakładka, której ten ekran w ogóle nie ma; ekran
 * tymczasem czekał na własne zapytanie dopiero po hydratacji.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { tab, category, author } = await searchParams;
  const queryClient = getQueryClient();

  const type = tab && tab !== 'wszystko' ? TYPE_BY_PATH[tab] : undefined;

  await Promise.allSettled([
    queryClient.prefetchQuery(
      contentListQuery({
        ...(type && { type }),
        ...(category && { category }),
        ...(author && { author }),
        sort: 'new',
        limit: 24,
      }),
    ),
    queryClient.prefetchQuery(categoriesQuery(type)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DiscoverScreen />
    </HydrationBoundary>
  );
}
