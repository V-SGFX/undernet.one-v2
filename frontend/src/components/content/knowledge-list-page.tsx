import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { Suspense } from 'react';
import { getQueryClient } from '@/lib/query-client';
import { KnowledgeListScreen } from '@/components/content/knowledge-list-screen';
import { contentListQuery, categoriesQuery, type ContentType } from '@/lib/queries/knowledge';

/**
 * Serwerowa oprawa listy materiałów.
 *
 * Cztery adresy — /news, /articles, /how-to i /wiki — renderowały wyłącznie
 * pustą ramkę: ekran jest komponentem klienckim, więc treść pojawiała się
 * dopiero po pobraniu JS-a, hydratacji i dwóch przejściach po sieci
 * (`/content` i `/content-categories`). API odpowiada w ok. 130 ms, a mimo
 * to strony sprawiały wrażenie wolnych — bo liczyło się wszystko przed nimi.
 *
 * Pobieramy pierwszą stronę i drzewo kategorii tutaj, pod tym samym kluczem,
 * którego użyje przeglądarka. Dalsze strony i zmiany filtrów zostają po
 * stronie klienta: tam trafienie w pamięć podręczną jest już natychmiastowe.
 */
export async function KnowledgeListPage({
  type, title, description,
}: {
  type: ContentType;
  title: string;
  description: string;
}) {
  const queryClient = getQueryClient();

  await Promise.allSettled([
    queryClient.prefetchQuery(contentListQuery({ type, sort: 'new', page: 1, limit: 24 })),
    queryClient.prefetchQuery(categoriesQuery(type)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={null}>
        <KnowledgeListScreen type={type} title={title} description={description} />
      </Suspense>
    </HydrationBoundary>
  );
}
