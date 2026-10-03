'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessagesSquare, X, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface SourcePost {
  id: number;
  title: string;
  commentCount?: number;
  community?: { slug: string; name: string } | null;
}

/**
 * Wątek, z którego powstał materiał.
 *
 * Było tu pole liczbowe z podpowiedzią „Numer wątku forum". Numer trzeba
 * było skądś wziąć — z pamięci albo z adresu — a wpisanie cudzego wiązało
 * materiał z niewłaściwą dyskusją i nikt by tego nie zauważył, bo pole
 * pokazywało wyłącznie liczbę.
 *
 * Teraz wątek przychodzi z przycisku „Zaproponuj materiał" pod samą
 * dyskusją (`?zrodlo=`), a pole pokazuje jego TYTUŁ z odnośnikiem — widać
 * od razu, czy to ten. Wpisanie numeru ręcznie zostaje jako wyjście
 * awaryjne i też podciąga tytuł do sprawdzenia.
 */
export function SourcePostField({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
}) {
  const [post, setPost] = useState<SourcePost | null>(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!value) { setPost(null); setMissing(false); return; }
    setLoading(true);
    setMissing(false);
    api.get(`/posts/${value}`)
      .then(({ data }) => setPost({
        id: data.id,
        title: data.title,
        commentCount: data.commentCount,
        community: data.community ?? null,
      }))
      .catch(() => { setPost(null); setMissing(true); })
      .finally(() => setLoading(false));
  }, [value]);

  if (loading) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-base px-3 py-2 text-xs text-content-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Wczytuję wątek…
      </p>
    );
  }

  if (value && post) {
    return (
      <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
        <div className="flex items-start gap-2">
          <MessagesSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-content-primary">{post.title}</p>
            <p className="mt-0.5 text-2xs text-content-muted">
              {post.community ? `c/${post.community.slug}` : 'bez społeczności'}
              {typeof post.commentCount === 'number' && ` · ${post.commentCount} odp.`}
            </p>
          </div>
          <Link
            href={`/posts/${post.id}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Otwórz wątek w nowej karcie"
            className="shrink-0 text-content-muted transition-colors hover:text-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Odepnij wątek"
              className="shrink-0 text-content-muted transition-colors hover:text-rose-400"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={manual}
          disabled={disabled}
          placeholder="Numer wątku, np. 7"
          onChange={(e) => setManual(e.target.value)}
          onBlur={() => { if (manual) onChange(Number(manual)); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); if (manual) onChange(Number(manual)); }
          }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary outline-none focus:border-accent disabled:opacity-50"
        />
      </div>
      {missing && (
        <p className="text-xs text-rose-400">Nie ma wątku o tym numerze.</p>
      )}
      <p className="text-2xs text-content-muted">
        Zwykle nie trzeba tu nic wpisywać — wygodniej zacząć przyciskiem
        „Zaproponuj materiał” pod samą dyskusją.
      </p>
    </div>
  );
}
