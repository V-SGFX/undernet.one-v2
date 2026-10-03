'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { BookOpen, Newspaper, Wrench, FileText, Clock } from 'lucide-react';
import { PATH_BY_TYPE, type ContentSummary, type ContentType } from '@/lib/queries/knowledge';

const ICON: Record<ContentType, typeof BookOpen> = {
  NEWS: Newspaper,
  ARTICLE: FileText,
  HOWTO: Wrench,
  WIKI: BookOpen,
};

const LABEL: Record<ContentType, string> = {
  NEWS: 'News',
  ARTICLE: 'Artykuł',
  HOWTO: 'How To',
  WIKI: 'Wiki',
};

/**
 * Kafelek materiału bazy wiedzy.
 *
 * Jeden komponent na cztery typy. Różnią się ikoną, etykietą i adresem —
 * cztery komponenty różniłyby się tym samym, a rozjechałyby się przy
 * pierwszej zmianie układu.
 *
 * Obrazek jest opcjonalny i nie rezerwujemy na niego miejsca, gdy go nie
 * ma: wpis wiki rzadko ma okładkę, a pusty prostokąt nad tytułem wygląda
 * jak coś, co się nie wczytało.
 */
export function KnowledgeCard({ item }: { item: ContentSummary }) {
  const [imageFailed, setImageFailed] = useState(false);
  const Icon = ICON[item.type];
  const href = `/${PATH_BY_TYPE[item.type]}/${item.slug}`;
  const showImage = Boolean(item.coverUrl) && !imageFailed;

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface-raised transition-colors hover:border-line-strong">
      {showImage && (
        <Link href={href} className="relative block aspect-video overflow-hidden bg-surface-sunken">
          {/*
            next/image tylko dla NASZYCH plików.

            Grafika spod obcej domeny musi mieć wpis w `remotePatterns`,
            a redakcja wkleja adresy z serwisów, których nie da się z góry
            wyliczyć — optymalizator odpowiada wtedy 400 i kafelek zostaje
            pusty. Zwykły <img> pokazuje każdy adres; tracimy zmniejszanie,
            ale obrazek się w ogóle pojawia.
          */}
          {item.coverUrl!.startsWith('/uploads') ? (
            <Image
              src={item.coverUrl!}
              alt=""
              fill
              sizes="(min-width: 1024px) 380px, 100vw"
              onError={() => setImageFailed(true)}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <img
              src={item.coverUrl!}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
        </Link>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-2xs text-content-muted">
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{LABEL[item.type]}</span>
          {item.category && (
            <>
              <span aria-hidden="true">·</span>
              <Link href={`/discover?tab=${PATH_BY_TYPE[item.type]}&category=${item.category.slug}`} className="truncate hover:text-content-primary">
                {item.category.name}
              </Link>
            </>
          )}
        </div>

        <h3 className="text-sm font-semibold leading-snug text-content-primary">
          <Link href={href} className="hover:text-accent">{item.title}</Link>
        </h3>

        {item.excerpt && (
          <p className="line-clamp-2 text-xs leading-relaxed text-content-muted">{item.excerpt}</p>
        )}

        <div className="mt-auto flex items-center gap-3 pt-1 text-2xs text-content-muted">
          {item.author && <span className="truncate">{item.author.name}</span>}
          {item.readingTime && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {item.readingTime} min
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** Siatka kafelków. Cztery kolumny od 1280 px, dwie od 768, jedna niżej. */
export function KnowledgeGrid({ items }: { items: ContentSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <KnowledgeCard key={`${item.type}-${item.id}`} item={item} />
      ))}
    </div>
  );
}
