import { apiOrigin } from '@/lib/api-url';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { feedQuery } from '@/lib/queries/feed-query';
import CommunityFeedPage from '../community-feed-client';

interface CommunitySlugPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = 'https://undernet.one';
const API_URL = apiOrigin();

async function pobierz(slug: string) {
  try {
    /*
     * `cache: 'no-store'`, nie `revalidate`.
     *
     * Od tej odpowiedzi zależy, czy strona w ogóle ISTNIEJE (`notFound()`
     * niżej). Pamięć podręczna pobrań w Next leży w `.next/cache/fetch-cache`
     * i PRZEŻYWA PRZEBUDOWĘ — skasowana społeczność oddawała 200 z zapisanej
     * kopii jeszcze długo po wdrożeniu nowej wersji.
     *
     * Materiały bazy wiedzy mogą sobie pozwolić na `revalidate`, bo mają
     * tagi i backend unieważnia je przy kasowaniu (`content.service` →
     * `/api/revalidate`). Moduł społeczności NIE woła unieważnienia ani
     * razu, więc tutaj nie ma czego czekać.
     */
    const res = await fetch(`${API_URL}/api/communities/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: CommunitySlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const c = await pobierz(slug);

  /*
   * Adres kanoniczny to ŚCIEŻKA, nie parametr.
   *
   * Wcześniej ta strona tylko przekierowywała na `/community?community=<slug>`
   * i wskazywała ten adres jako kanoniczny. Przy jednej społeczności to nie
   * miało znaczenia; przy kilkudziesięciu ścieżka jest czytelniejsza dla
   * człowieka i lepiej indeksowana. Adres z parametrem nadal działa —
   * po prostu nie jest już tym, który zgłaszamy wyszukiwarce.
   */
  const canonical = `${BASE_URL}/community/${encodeURIComponent(c?.slug || slug)}`;
  const nazwa = c?.name || slug;
  const opis =
    c?.description?.trim() ||
    `Społeczność c/${nazwa} na UNDERNET.ONE: pytania, problemy i bieżące wątki.`;

  /*
   * Pusta społeczność nie trafia do indeksu.
   *
   * Strona bez ani jednego wątku wygląda identycznie jak kilkadziesiąt
   * innych pustych i nie niesie żadnej treści — a to definicja strony
   * bezwartościowej. Zostaje dostępna dla ludzi, znika dla robotów.
   * Wraca do indeksu sama, gdy pojawi się pierwszy wątek.
   */
  const pusta = (c?.postCount ?? 0) === 0;

  return {
    title: `c/${nazwa} — społeczność`,
    description: opis,
    alternates: { canonical },
    ...(pusta && { robots: { index: false, follow: true } }),
    openGraph: {
      title: `c/${nazwa} — społeczność`,
      description: opis,
      url: canonical,
      images: ['/opengraph-image'],
    },
  };
}

export default async function CommunitySlugPage({ params }: CommunitySlugPageProps) {
  const { slug } = await params;
  const c = await pobierz(slug);
  if (!c) notFound();

  const queryClient = getQueryClient();
  // Ta sama treść co pod adresem z parametrem — widok ma być nieodróżnialny.
  await queryClient.prefetchInfiniteQuery(feedQuery({ community: slug })).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommunityFeedPage wymuszonySlug={slug} />
    </HydrationBoundary>
  );
}
