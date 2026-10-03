import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { HomeScreen } from '@/components/home/home-screen';
import { getQueryClient } from '@/lib/query-client';
import { feedQuery, communitiesQuery } from '@/lib/queries/feed-query';
import { contentListQuery } from '@/lib/queries/knowledge';

export const metadata: Metadata = {
  title: 'UNDERNET.ONE — wiedza techniczna od prawdziwego problemu',
  description:
    'Forum, artykuły, instrukcje i wiki dla administratorów i programistów. Materiały wyrastają z realnych dyskusji, nie z przepisanej dokumentacji.',
  alternates: {
    canonical: 'https://undernet.one/',
  },
  openGraph: {
    title: 'UNDERNET.ONE — wiedza techniczna od prawdziwego problemu',
    description:
      'Dyskusje, artykuły, how-to i wiki: Linux, sieci, kod, sprzęt i bezpieczeństwo w jednym miejscu.',
    url: 'https://undernet.one/',
    images: ['/opengraph-image'],
  },
};

export default async function HomePage() {
  /*
   * Strona główna dostarczana z treścią, nie z siatką szkieletów.
   *
   * Pobieramy dokładnie to, co ekran renderuje: cztery sekcje materiałów,
   * listę społeczności i pierwszą stronę ściany. Wcześniej stały tu dwa
   * zapytania — kanał i „streamerzy nadający teraz". To drugie biło
   * w /streamers, endpoint, którego backend undernetu nie ma: każde
   * wejście na stronę główną kosztowało nieudane zapytanie z ponowieniem,
   * a sekcje i tak dociągały się dopiero w przeglądarce.
   *
   * allSettled, nie all: jedno puste zapytanie nie może zabrać całej strony.
   */
  const queryClient = getQueryClient();

  await Promise.allSettled([
    queryClient.prefetchQuery(contentListQuery({ type: 'ARTICLE', limit: 4 })),
    queryClient.prefetchQuery(contentListQuery({ type: 'HOWTO', sort: 'popular', limit: 4 })),
    queryClient.prefetchQuery(contentListQuery({ type: 'WIKI', limit: 4 })),
    queryClient.prefetchQuery(contentListQuery({ type: 'NEWS', limit: 4 })),
    queryClient.prefetchQuery(communitiesQuery()),
    // Limit musi zgadzać się z tym, o co prosi LatestDiscussions —
    // inny limit to inny klucz, czyli pobranie na próżno.
    queryClient.prefetchInfiniteQuery(feedQuery({}, 6)),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'UNDERNET.ONE — filary serwisu',
            itemListOrder: 'Descending',
            numberOfItems: 5,
            itemListElement: [
              { '@type': 'ListItem', position: 1, url: 'https://undernet.one/community' },
              { '@type': 'ListItem', position: 2, url: 'https://undernet.one/articles' },
              { '@type': 'ListItem', position: 3, url: 'https://undernet.one/how-to' },
              { '@type': 'ListItem', position: 4, url: 'https://undernet.one/wiki' },
              { '@type': 'ListItem', position: 5, url: 'https://undernet.one/news' },
            ],
          }),
        }}
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <HomeScreen />
      </HydrationBoundary>
    </>
  );
}
