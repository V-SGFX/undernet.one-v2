'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useDerivedContent, PATH_BY_TYPE } from '@/lib/queries/knowledge';

const LABEL = { NEWS: 'News', ARTICLE: 'Artykuł', HOWTO: 'Poradnik', WIKI: 'Wpis wiki' } as const;

/**
 * „Ten wątek stał się źródłem materiału."
 *
 * Druga strona `ContentItem.sourcePostId` i sedno idei portalu: dyskusja
 * nie kończy się na sobie. Baner pojawia się wyłącznie wtedy, gdy coś
 * z tego wątku faktycznie powstało — pusta ramka „brak materiałów"
 * sugerowałaby, że każdy wątek powinien jakiś mieć.
 */
export function DerivedContentBanner({ postId }: { postId: number }) {
  const { data } = useDerivedContent(postId);
  if (!data?.length) return null;

  return (
    <section className="my-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
      <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {data.length === 1 ? 'Ten temat został wykorzystany jako źródło' : 'Materiały powstałe z tego tematu'}
      </h2>

      <ul className="mt-2 space-y-1.5">
        {data.map((item) => (
          <li key={item.id}>
            <Link
              href={`/${PATH_BY_TYPE[item.type]}/${item.slug}`}
              className="group inline-flex items-center gap-1.5 text-sm text-content-primary hover:text-accent"
            >
              <span className="rounded border border-line px-1.5 py-0.5 text-2xs text-content-muted">
                {LABEL[item.type]}
              </span>
              <span className="underline-offset-2 group-hover:underline">{item.title}</span>
              <ArrowRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
