'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { MessagesSquare, Clock, History, ExternalLink, ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { AdSlot } from '@/components/ads/ad-slot';
import { CoverImage } from '@/components/content/cover-image';
import { BodyWithMidAd } from '@/components/content/body-with-mid-ad';
import { KnowledgeGrid } from '@/components/content/knowledge-card';
import { countLabel } from '@/lib/plural';
import { PATH_BY_TYPE, type ContentSummary, type ContentType } from '@/lib/queries/knowledge';
import { RelativeTime } from '@/components/content/relative-time';
import { AddToCollection } from '@/components/content/add-to-collection';
import { PrivateNote } from '@/components/content/private-note';

export interface ContentDetail extends ContentSummary {
  body: string;
  // Pola SEO. Puste oznacza „użyj tytułu i zajawki" — redakcja nadpisuje
  // je tylko wtedy, gdy chce w wyszukiwarce czegoś innego niż na stronie.
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  sources: { url: string; label?: string }[] | null;
  status: string;
  sourcePost: {
    id: number;
    title: string;
    commentCount: number;
    community: { slug: string; name: string } | null;
  } | null;
}

/**
 * Dział Community właściwy dla kategorii materiału.
 *
 * Odwzorowanie jest jawne, a nie zgadywane po podobieństwie nazw: kategoria
 * bazy wiedzy i dział forum to dwa osobne byty i nic nie gwarantuje, że
 * będą się nazywać tak samo. Nieznana kategoria trafia do grupy nadrzędnej
 * — lepiej za szeroko niż w niewłaściwy dział.
 */
function spolecznoscDlaKategorii(kategoria?: string | null): string {
  const mapa: Record<string, string> = {
    system: 'linux',
    siec: 'sieci',
    kod: 'programowanie',
    sprzet: 'sprzet',
    bezpieczenstwo: 'bezpieczenstwo',
  };
  return mapa[kategoria ?? ''] ?? 'technologia';
}

const LABEL: Record<ContentType, string> = {
  NEWS: 'News', ARTICLE: 'Artykuł', HOWTO: 'How To', WIKI: 'Wiki',
};

/**
 * Materiał bazy wiedzy.
 *
 * Treść jest HTML-em z edytora TipTap i tak jest wstawiana. Ostrożność
 * siedzi po stronie zapisu: backend przepuszcza `body` przez DOMPurify
 * z zamkniętą listą znaczników, więc w bazie nie ma czego odkażać przy
 * odczycie. To istotne, odkąd hasło wiki może zaproponować każdy
 * zalogowany, a nie tylko redakcja.
 */
export function KnowledgeDetail({
  item, related,
}: {
  item: ContentDetail;
  related: ContentSummary[];
}) {

  return (
    <AppLayout>
      <article className="mx-auto w-full max-w-3xl">
        <nav aria-label="Okruszki" className="mb-3 flex flex-wrap items-center gap-1.5 text-2xs text-content-muted">
          <Link href={`/${PATH_BY_TYPE[item.type]}`} className="hover:text-content-primary">
            {LABEL[item.type]}
          </Link>
          {item.category && (
            <>
              <span aria-hidden="true">/</span>
              <Link
                href={`/${PATH_BY_TYPE[item.type]}?category=${item.category.slug}`}
                className="hover:text-content-primary"
              >
                {item.category.name}
              </Link>
            </>
          )}
        </nav>

        <h1 className="text-2xl font-bold leading-tight tracking-tight text-content-primary">
          {item.title}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-2xs text-content-muted">
          {item.author && (
            <Link href={`/discover?author=${item.author.slug}`} className="hover:text-content-primary">
              {item.author.name}
            </Link>
          )}
          {item.publishedAt && <RelativeTime iso={item.publishedAt} />}
          {item.readingTime && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {item.readingTime} min czytania
            </span>
          )}
          {/* Wiki żyje — data ostatniej aktualizacji mówi tu więcej niż
              data publikacji, więc pokazujemy obie tylko wtedy, gdy się różnią. */}
          {item.type === 'WIKI' && item.updatedAt !== item.publishedAt && (
            <span className="inline-flex items-center gap-1">
              <History className="h-3 w-3" aria-hidden="true" />
              zaktualizowano <RelativeTime iso={item.updatedAt} />
            </span>
          )}
        </div>

        {/* Grafika stoi między tytułem a zajawką — czytelnik widzi
            najpierw, o czym rzecz, potem obrazek, potem streszczenie. */}
        {item.coverUrl && <CoverImage src={item.coverUrl} />}

        {item.excerpt && (
          <p className="mt-4 text-base leading-relaxed text-content-secondary">{item.excerpt}</p>
        )}

        {/*
          Treść jest HTML-em z edytora, nie tekstem.
          Wstawiona jako `{item.body}` renderowała się dosłownie — czytelnik
          widział `<p>`, `<h2>` i `<pre>` jako tekst na stronie. Backend
          czyści ją DOMPurify przy zapisie, więc do bazy trafia już tylko to,
          co wolno pokazać; tutaj wystarczy ją wstawić.
        */}
        <BodyWithMidAd html={item.body} />

        {item.tags.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {item.tags.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/discover?tag=${t.slug}`}
                  className="rounded-lg border border-line px-2.5 py-1 text-2xs text-content-muted hover:border-accent hover:text-accent"
                >
                  #{t.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {item.sources && item.sources.length > 0 && (
          <section className="mt-6 rounded-lg border border-line bg-surface-raised p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-content-muted">Źródła</h2>
            <ul className="mt-2 space-y-1">
              {item.sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{s.label || s.url}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* FORUM → WIEDZA. Sekcja pojawia się wyłącznie wtedy, gdy materiał
            naprawdę ma źródło w dyskusji — pusta ramka „brak źródła"
            mówiłaby, że coś się nie wczytało. */}
        {item.sourcePost && (
          <section className="mt-6 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-accent">Źródło dyskusji</h2>
            <Link
              href={`/posts/${item.sourcePost.id}`}
              className="mt-2 block text-sm font-medium text-content-primary hover:text-accent"
            >
              {item.sourcePost.title}
            </Link>
            <p className="mt-1 inline-flex items-center gap-1.5 text-2xs text-content-muted">
              <MessagesSquare className="h-3 w-3" aria-hidden="true" />
              {countLabel(item.sourcePost.commentCount, 'komentarz', 'komentarze', 'komentarzy')}
              {item.sourcePost.community && ` · ${item.sourcePost.community.name}`}
            </p>
            <Link
              href={`/posts/${item.sourcePost.id}`}
              className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Zobacz dyskusję
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </section>
        )}

        {/* WIEDZA → FORUM, druga strona tego samego pomysłu.

            Pojawia się WYŁĄCZNIE tam, gdzie nie ma dyskusji źródłowej —
            czyli w miejscu, które dotąd było puste. To zaproszenie, a nie
            udawana dyskusja: wątek powstaje dopiero wtedy, gdy człowiek go
            napisze i opublikuje. Nic nie tworzy się automatycznie. */}
        {!item.sourcePost && (
          <section className="mt-6 rounded-lg border border-line bg-surface-raised p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
              Masz podobny problem albo inne rozwiązanie?
            </h2>
            <p className="mt-1 text-sm text-content-secondary">
              Ten materiał opisuje jedną drogę. Konfiguracje bywają różne — opisz swoją
              i zapytaj tych, którzy mieli to samo.
            </p>
            <Link
              href={`/community/${spolecznoscDlaKategorii(item.category?.slug)}?postType=TEXT`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/15"
            >
              Zapytaj społeczność
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </section>
        )}

        {/* Kolekcje i notatka — obie odpowiadają na „co z tym dalej",
            więc stoją razem, tuż pod treścią. */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <AddToCollection contentItemId={item.id} />
        </div>

        <PrivateNote contentItemId={item.id} />

        <AdSlot slotKey="article-body" className="my-6 flex justify-center empty:hidden" />

        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 border-b border-line pb-2 text-sm font-semibold uppercase tracking-wide text-content-primary">
              Powiązane
            </h2>
            <KnowledgeGrid items={related} />
          </section>
        )}
      </article>
    </AppLayout>
  );
}
