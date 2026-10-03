'use client';

import { Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Newspaper, FileText, Wrench, BookOpen, Hash, Users, LayoutGrid } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { TabBar } from '@/components/ui/tab-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AdSlot } from '@/components/ads/ad-slot';
import { KnowledgeGrid } from '@/components/content/knowledge-card';
import { useContentList, useCategories, type ContentType } from '@/lib/queries/knowledge';
import { useCommunities } from '@/lib/queries/content';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Tab = 'wszystko' | 'news' | 'articles' | 'how-to' | 'wiki' | 'communities' | 'tags';

const TABS: Tab[] = ['wszystko', 'news', 'articles', 'how-to', 'wiki', 'communities', 'tags'];

/** Zakładka → typ materiału. `wszystko` nie filtruje po typie. */
const TYPE_BY_TAB: Partial<Record<Tab, ContentType>> = {
  news: 'NEWS',
  articles: 'ARTICLE',
  'how-to': 'HOWTO',
  wiki: 'WIKI',
};

const LABELS: Record<Tab, string> = {
  wszystko: 'Wszystko',
  news: 'News',
  articles: 'Artykuły',
  'how-to': 'How To',
  wiki: 'Wiki',
  communities: 'Społeczności',
  tags: 'Tagi',
};

const ICONS: Record<Tab, React.ReactNode> = {
  wszystko: <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />,
  news: <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />,
  articles: <FileText className="h-3.5 w-3.5" aria-hidden="true" />,
  'how-to': <Wrench className="h-3.5 w-3.5" aria-hidden="true" />,
  wiki: <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />,
  communities: <Users className="h-3.5 w-3.5" aria-hidden="true" />,
  tags: <Hash className="h-3.5 w-3.5" aria-hidden="true" />,
};

function isTab(v: string | null): v is Tab {
  return TABS.includes(v as Tab);
}

/**
 * Odkrywaj.
 *
 * Jeden ekran na wszystkie typy treści, nie siedem osobnych stron.
 * Filtry — kategoria, sortowanie, stronicowanie — są wspólne, więc
 * osobne strony powielałyby je siedmiokrotnie i rozjechały się przy
 * pierwszej zmianie.
 */
function DiscoverInner() {
  const router = useRouter();
  const params = useSearchParams();
  const active: Tab = isTab(params.get('tab')) ? (params.get('tab') as Tab) : 'wszystko';
  const category = params.get('category') ?? undefined;
  /*
   * Filtr po autorze.
   *
   * Odnośnik z podpisu pod materiałem prowadzi na `?author=<slug>`, ale
   * ekran tego parametru nie czytał — klik pokazywał po prostu wszystko.
   * Podpis autora, który nic nie robi, jest gorszy niż podpis bez odnośnika.
   */
  const author = params.get('author') ?? undefined;
  const sort = (params.get('sort') as 'new' | 'popular') ?? 'new';

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const qs = new URLSearchParams(params.toString());
      if (value) qs.set(key, value);
      else qs.delete(key);
      // Zmiana zakładki kasuje filtr kategorii: kategorie wiedzy nie są
      // wspólne ze społecznościami, więc przeniesiony filtr dałby pustkę.
      if (key === 'tab') qs.delete('category');
      router.replace(`/discover?${qs.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const isContent = active !== 'communities' && active !== 'tags';
  const list = useContentList({
    ...(TYPE_BY_TAB[active] && { type: TYPE_BY_TAB[active] }),
    ...(category && { category }),
    ...(author && { author }),
    sort,
    limit: 24,
  });

  return (
    <AppLayout>
      <AdSlot slotKey="discover-top" className="mb-3 flex justify-center empty:hidden" />

      {/* Tak jak na stronie głównej — brakowało nagłówka pierwszego poziomu.
          Pasek zakładek niósł nazwę tylko w `aria-label`, więc dla wyszukiwarki
          ta strona nie miała tytułu w treści. */}
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-content-primary">Odkrywaj</h1>
        <p className="mt-1 text-sm text-content-muted">
          Wszystko naraz: newsy, artykuły, instrukcje, wiki i społeczności.
        </p>
      </header>

      <TabBar
        idPrefix="discover"
        label="Odkrywaj"
        value={active}
        onChange={(t) => setParam('tab', t === 'wszystko' ? null : t)}
        items={TABS.map((t) => ({ value: t, label: LABELS[t], icon: ICONS[t] }))}
      />

      <div id="discover-panel" role="tabpanel" aria-labelledby={`discover-tab-${active}`} tabIndex={-1}>
        {isContent && (
          <>
            {author && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-1.5 text-xs">
                <span className="text-content-muted">Autor:</span>
                <strong className="text-content-primary">{author}</strong>
                <button
                  type="button"
                  onClick={() => setParam('author', null)}
                  aria-label="Wyczyść filtr autora"
                  className="text-content-muted transition-colors hover:text-accent"
                >
                  ×
                </button>
              </div>
            )}

            <ContentFilters
              category={category}
              sort={sort}
              type={TYPE_BY_TAB[active]}
              onCategory={(c) => setParam('category', c)}
              onSort={(s) => setParam('sort', s === 'new' ? null : s)}
            />

            {list.isLoading && <GridSkeleton />}

            {!list.isLoading && (list.data?.data.length ?? 0) === 0 && (
              <EmptyState
                title="Nic tu jeszcze nie ma"
                description="Ta sekcja czeka na pierwszy materiał."
              />
            )}

            {!list.isLoading && (list.data?.data.length ?? 0) > 0 && (
              <KnowledgeGrid items={list.data!.data} />
            )}
          </>
        )}

        {active === 'communities' && <CommunitiesGrid />}
        {active === 'tags' && <TagsGrid />}
      </div>
    </AppLayout>
  );
}

function ContentFilters({
  category, sort, type, onCategory, onSort,
}: {
  category?: string;
  sort: 'new' | 'popular';
  /** Aktywna zakładka. Licznik przy kategorii ma dotyczyć TEGO rodzaju. */
  type?: ContentType;
  onCategory: (slug: string | null) => void;
  onSort: (s: 'new' | 'popular') => void;
}) {
  const { data: categories } = useCategories(type);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onCategory(null)}
        aria-pressed={!category}
        className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
          !category ? 'border-accent text-accent' : 'border-line text-content-muted hover:text-content-primary'
        }`}
      >
        Wszystkie kategorie
      </button>

      {(categories ?? []).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onCategory(c.slug)}
          aria-pressed={category === c.slug}
          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
            category === c.slug ? 'border-accent text-accent' : 'border-line text-content-muted hover:text-content-primary'
          }`}
        >
          {c.name}
          {c._count.items > 0 && <span className="ml-1 text-content-muted">{c._count.items}</span>}
        </button>
      ))}

      <div className="ml-auto flex items-center gap-1">
        {(['new', 'popular'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSort(s)}
            aria-pressed={sort === s}
            className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
              sort === s ? 'text-accent' : 'text-content-muted hover:text-content-primary'
            }`}
          >
            {s === 'new' ? 'Najnowsze' : 'Popularne'}
          </button>
        ))}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}

function CommunitiesGrid() {
  const { data: communities, isLoading } = useCommunities();
  if (isLoading) return <GridSkeleton />;
  if (!communities?.length) {
    return <EmptyState title="Brak społeczności" description="Nie założono jeszcze żadnej." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {communities.map((c) => (
        <Link
          key={c.id}
          href={`/community?community=${c.slug}`}
          className="rounded-lg border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong"
        >
          <p className="text-sm font-semibold text-content-primary">{c.name}</p>
          {c.description && (
            <p className="mt-1 line-clamp-2 text-xs text-content-muted">{c.description}</p>
          )}
          <p className="mt-2 text-2xs text-content-muted">{c.postCount} postów</p>
        </Link>
      ))}
    </div>
  );
}

function TagsGrid() {
  /*
   * Katalog bierzemy z osobnego zapytania, a nie z listy materiałów.
   *
   * Poprzednia wersja zbierała tagi z POBRANYCH materiałów przy `limit: 1`,
   * więc pokazywała najwyżej te z jednego przypadkowego wpisu. Podniesienie
   * limitu nie jest rozwiązaniem: przy dwustu materiałach trzeba by ściągnąć
   * wszystkie, żeby poznać nazwy kilkudziesięciu tagów.
   *
   * Zasada z komentarza została — endpoint liczy WYŁĄCZNIE materiały
   * opublikowane, więc żaden tag nie prowadzi do pustej listy.
   */
  const { data, isLoading } = useQuery({
    queryKey: ['tags', 'w-materialach'],
    queryFn: async (): Promise<{ slug: string; name: string; count: number }[]> =>
      (await api.get('/tags/w-materialach')).data,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <p className="text-xs text-content-muted">Wczytywanie tagów…</p>;
  }

  if (!data?.length) {
    return <EmptyState title="Brak tagów" description="Tagi pojawią się razem z pierwszymi materiałami." />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {data.map((t) => (
        <Link
          key={t.slug}
          href={`/discover?tag=${t.slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-content-muted transition-colors hover:border-accent hover:text-accent"
        >
          #{t.name}
          {/* Liczba mówi, czy warto klikać — tag z jedną pozycją
              i tag z sześćdziesięcioma to dwie różne obietnice. */}
          <span className="text-2xs text-content-muted/70">{t.count}</span>
        </Link>
      ))}
    </div>
  );
}

export function DiscoverScreen() {
  return (
    <Suspense fallback={null}>
      <DiscoverInner />
    </Suspense>
  );
}
