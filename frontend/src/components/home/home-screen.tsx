'use client';

import Link from 'next/link';
import { MessagesSquare, BookOpen, Wrench, Newspaper, ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { AdSlot } from '@/components/ads/ad-slot';
import { KnowledgeGrid } from '@/components/content/knowledge-card';
import { useContentList } from '@/lib/queries/knowledge';
import { countLabel } from '@/lib/plural';
import { useCommunities, useFeed } from '@/lib/queries/content';

/**
 * Cztery filary portalu.
 *
 * Undernet nie jest blogiem ani kanałem — jest portalem, więc pierwsze,
 * co widać, to cztery drzwi, a nie strumień. Dopiero pod nimi zaczyna się
 * treść.
 */
const PILLARS = [
  {
    href: '/community',
    icon: MessagesSquare,
    title: 'Community',
    subtitle: 'Dyskusje, pytania, problemy',
    accent: 'text-accent',
  },
  {
    href: '/wiki',
    icon: BookOpen,
    title: 'Wiki',
    subtitle: 'Baza wiedzy',
    accent: 'text-sky-400',
  },
  {
    href: '/how-to',
    icon: Wrench,
    title: 'How To',
    subtitle: 'Poradniki krok po kroku',
    accent: 'text-amber-400',
  },
  {
    href: '/news',
    icon: Newspaper,
    title: 'News',
    subtitle: 'Aktualności techniczne',
    accent: 'text-rose-400',
  },
];

export function HomeScreen() {
  return (
    <AppLayout>
      <AdSlot slotKey="home-top" className="mb-4 flex justify-center empty:hidden" />

      {/*
        Strona główna nie miała ŻADNEGO <h1>.
        Układ kafelkowy nie potrzebuje wielkiego tytułu, ale dokument bez
        nagłówka pierwszego poziomu to strona bez nazwy — dla czytnika
        ekranu i dla wyszukiwarki. Stąd nagłówek dyskretny, nie ozdobny.
      */}
      <header className="mb-5">
        <h1 className="text-lg font-bold tracking-tight text-content-primary">
          Wiedza techniczna od prawdziwego problemu
        </h1>
        <p className="mt-1 text-sm text-content-muted">
          Dyskusja na forum, z niej artykuł albo instrukcja, a pojęcia, które wracają — do wiki.
        </p>
      </header>

      <Pillars />

      <Section
        title="Najnowsze artykuły"
        href="/articles"
        query={{ type: 'ARTICLE' as const, limit: 4 }}
      />
      <Section
        title="Popularne How To"
        href="/how-to"
        query={{ type: 'HOWTO' as const, sort: 'popular' as const, limit: 4 }}
      />
      <Section
        title="Ostatnio aktualizowane Wiki"
        href="/wiki"
        query={{ type: 'WIKI' as const, limit: 4 }}
      />
      <Section
        title="Najnowsze News"
        href="/news"
        query={{ type: 'NEWS' as const, limit: 4 }}
      />

      <ActiveCommunities />
      <LatestDiscussions />
    </AppLayout>
  );
}

function Pillars() {
  return (
    <nav aria-label="Główne działy" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {PILLARS.map(({ href, icon: Icon, title, subtitle, accent }) => (
        <Link
          key={href}
          href={href}
          className="group rounded-lg border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong"
        >
          <Icon className={`mb-2 h-5 w-5 ${accent}`} aria-hidden="true" />
          <p className="text-sm font-semibold text-content-primary">{title}</p>
          <p className="mt-0.5 text-2xs text-content-muted">{subtitle}</p>
        </Link>
      ))}
    </nav>
  );
}

/**
 * Sekcja z materiałami jednego typu.
 *
 * Cztery kafelki, nie dwadzieścia: strona główna ma pokazać, że coś jest,
 * a nie zastąpić listę. Pełna lista jest pod nagłówkiem, jedno kliknięcie
 * dalej — i to ona pobiera resztę.
 */
function Section({
  title, href, query,
}: {
  title: string;
  href: string;
  query: Parameters<typeof useContentList>[0];
}) {
  const { data, isLoading } = useContentList(query);
  const items = data?.data ?? [];

  // Pusta sekcja nie renderuje się wcale. Nagłówek nad pustką mówi
  // odwiedzającemu wyłącznie tyle, że portal jest niedokończony.
  if (!isLoading && items.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionHeading title={title} href={href} />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <KnowledgeGrid items={items} />
      )}
    </section>
  );
}

function SectionHeading({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-content-primary">{title}</h2>
      <Link href={href} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
        Zobacz wszystkie
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}

function ActiveCommunities() {
  const { data } = useCommunities();
  const communities = (data ?? []).filter((c) => c.postCount > 0).slice(0, 6);
  if (communities.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionHeading title="Aktywne społeczności" href="/discover?tab=communities" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {communities.map((c) => (
          <Link
            key={c.id}
            href={`/community?community=${c.slug}`}
            className="rounded-lg border border-line bg-surface-raised p-3 transition-colors hover:border-line-strong"
          >
            <p className="text-sm font-medium text-content-primary">{c.name}</p>
            <p className="mt-0.5 text-2xs text-content-muted">{c.postCount} postów</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LatestDiscussions() {
  const { data, isLoading } = useFeed({}, 6);
  const posts = (data?.pages ?? []).flatMap((p: any) => p.data ?? []).slice(0, 6);
  if (!isLoading && posts.length === 0) return null;

  return (
    <section className="mb-8">
      <SectionHeading title="Najnowsze dyskusje" href="/community" />
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
        {posts.map((p: any) => (
          <li key={p.id}>
            <Link href={`/posts/${p.id}`} className="block px-4 py-3 transition-colors hover:bg-surface-hover">
              <p className="truncate text-sm text-content-primary">{p.title}</p>
              <p className="mt-0.5 text-2xs text-content-muted">
                {p.community?.name ?? 'Ogólne'} · {countLabel(p.commentCount ?? 0, 'komentarz', 'komentarze', 'komentarzy')}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
