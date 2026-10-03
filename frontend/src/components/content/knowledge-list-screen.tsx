'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/lib/auth-context';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AdSlot } from '@/components/ads/ad-slot';
import { KnowledgeGrid } from '@/components/content/knowledge-card';
import { useContentList, useCategories, type ContentType } from '@/lib/queries/knowledge';

interface Props {
  type: ContentType;
  title: string;
  description: string;
}

/**
 * Lista materiałów jednego typu.
 *
 * Jeden komponent obsługuje /news, /articles, /how-to i /wiki. Cztery
 * osobne różniłyby się nagłówkiem i wartością `type` — a rozjechały się
 * przy pierwszej zmianie filtrów albo stronicowania.
 */
export function KnowledgeListScreen({ type, title, description }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const category = params.get('category') ?? undefined;
  const sort = (params.get('sort') as 'new' | 'popular') ?? 'new';
  const page = Math.max(1, Number(params.get('page') ?? 1));

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const qs = new URLSearchParams(params.toString());
      if (value) qs.set(key, value);
      else qs.delete(key);
      // Zmiana filtra wraca na pierwszą stronę — inaczej ląduje się
      // na stronie 7 zbioru, który ma trzy strony, i widzi pustkę.
      if (key !== 'page') qs.delete('page');
      const s = qs.toString();
      router.replace(s ? `?${s}` : '?', { scroll: false });
    },
    [params, router],
  );

  const { data, isLoading } = useContentList({ type, category, sort, page, limit: 24 });
  const { data: categories } = useCategories(type);

  /*
   * Podkategorie otwartej grupy.
   *
   * Widoczne także wtedy, gdy stoimy w podkategorii — inaczej wybranie
   * „Sieci" chowałoby pasek, z którego się ją wybrało, i nie dałoby się
   * przejść do sąsiedniej bez cofania.
   */
  const grupaOtwarta = (categories ?? []).find(
    (c) => c.slug === category || (c.children ?? []).some((d) => d.slug === category),
  );
  const podkategorie = grupaOtwarta?.children ?? [];
  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <AppLayout>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-content-primary">{title}</h1>
          <p className="mt-1 text-sm text-content-muted">{description}</p>
        </div>

        {/* Wiki jest wspólna — każdy zalogowany może dopisać hasło, a moderacja
            je przeczyta przed publikacją. Bez tego przycisku możliwość
            istniałaby wyłącznie dla kogoś, kto zna adres /studio/nowy. */}
        {type === 'WIKI' && user && (
          <Link
            href="/studio/nowy?typ=wiki"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-content-primary transition-colors hover:border-accent hover:text-accent"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Zaproponuj hasło
          </Link>
        )}
      </header>

      {/* Kategorie na dwóch poziomach, tak samo jak działy Community.

          Górny poziom to grupy i pokazujemy je zawsze, także puste — po to,
          żeby dało się zobaczyć, że taki dział w ogóle istnieje. Podkategorie
          pojawiają się dopiero po wejściu w grupę; wcześniej zajmowałyby
          ekran listą, której nikt nie prosił.

          Licznik grupy sumuje jej podkategorie, bo materiały wiszą na nich,
          nie na grupie — bez sumowania „Technologia" pokazywałaby zero przy
          dwustu pozycjach pod spodem. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setParam('category', null)}
          aria-pressed={!category}
          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
            !category ? 'border-accent text-accent' : 'border-line text-content-muted hover:text-content-primary'
          }`}
        >
          Wszystkie
        </button>
        {(categories ?? []).map((c) => {
          const ile = (c._count?.items ?? 0) + (c.children ?? []).reduce((a, d) => a + (d._count?.items ?? 0), 0);
          const wybrana = category === c.slug || (c.children ?? []).some((d) => d.slug === category);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setParam('category', c.slug)}
              aria-pressed={category === c.slug}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                wybrana ? 'border-accent text-accent' : 'border-line text-content-muted hover:text-content-primary'
              }`}
            >
              {c.name}
              <span className="opacity-60">{ile}</span>
            </button>
          );
        })}
      </div>

      {podkategorie.length > 0 && (
        <div className="-mt-2 mb-4 flex flex-wrap items-center gap-2">
          {podkategorie.map((d) => {
            const pusta = (d._count?.items ?? 0) === 0;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setParam('category', d.slug)}
                aria-pressed={category === d.slug}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-2xs transition-colors ${
                  category === d.slug
                    ? 'border-accent text-accent'
                    : pusta
                      ? 'border-line/60 text-content-muted/60 hover:text-content-primary'
                      : 'border-line text-content-muted hover:text-content-primary'
                }`}
              >
                {d.name}
                <span className="opacity-60">{d._count?.items ?? 0}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sortowanie w osobnym wierszu, pod kategoriami.
          Wcześniej siedziało w tym samym kontenerze co chipsy i przy większej
          liczbie działów wpadało między poziom grup a poziom podkategorii —
          czyli w miejsce, które sugerowało, że należy do kategorii. */}
      <div className="mb-4 flex items-center justify-end gap-1">
        {(['new', 'popular'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setParam('sort', s === 'new' ? null : s)}
            aria-pressed={sort === s}
            className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
              sort === s ? 'text-accent' : 'text-content-muted hover:text-content-primary'
            }`}
          >
            {s === 'new' ? 'Najnowsze' : 'Popularne'}
          </button>
        ))}
        </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <EmptyState title="Nic tu jeszcze nie ma" description="Ta sekcja czeka na pierwszy materiał." />
      )}

      {!isLoading && items.length > 0 && (
        <>
          <KnowledgeGrid items={items} />
          <AdSlot slotKey="feed-inline" className="my-6 flex justify-center empty:hidden" />
        </>
      )}

      {meta && meta.pages > 1 && (
        <nav aria-label="Stronicowanie" className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-content-muted disabled:opacity-40 enabled:hover:text-content-primary"
          >
            Poprzednia
          </button>
          <span className="text-xs text-content-muted">{page} z {meta.pages}</span>
          <button
            type="button"
            disabled={page >= meta.pages}
            onClick={() => setParam('page', String(page + 1))}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-content-muted disabled:opacity-40 enabled:hover:text-content-primary"
          >
            Następna
          </button>
        </nav>
      )}
    </AppLayout>
  );
}
