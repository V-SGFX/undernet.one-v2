'use client';

import Link from 'next/link';
import { NotebookPen, Trash2, Loader2 } from 'lucide-react';
import { useNotes, useNoteMutations } from '@/lib/queries/notes';
import { RelativeTime } from '@/components/content/relative-time';
import { PATH_BY_TYPE, type ContentType } from '@/lib/queries/knowledge';

/**
 * Wszystkie prywatne notatki w jednym miejscu.
 *
 * Bez bramki PRO: kto stracił abonament, ma prawo odczytać i wynieść to,
 * co sam napisał. Płatne jest pisanie nowych, nie dostęp do własnych.
 */
export function NotesWall() {
  const { data: notatki, isLoading } = useNotes();
  const { usun } = useNoteMutations();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!notatki || notatki.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center">
        <NotebookPen className="mx-auto mb-3 h-6 w-6 text-text-muted" />
        <p className="text-sm text-text-secondary">Nie masz jeszcze żadnych notatek.</p>
        <p className="mt-1 text-xs text-text-muted">
          Notatkę dodasz pod każdym materiałem i wątkiem — widzisz ją tylko Ty.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notatki.map((n) => {
        const href = n.post
          ? `/posts/${n.post.id}`
          : n.contentItem
            ? `/${PATH_BY_TYPE[n.contentItem.type as ContentType]}/${n.contentItem.slug}`
            : null;
        const tytul = n.post?.title ?? n.contentItem?.title ?? 'Usunięta treść';

        return (
          <article key={n.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {href ? (
                  <Link href={href} className="text-sm font-medium text-text-primary hover:text-neon-cyan">
                    {tytul}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-text-muted">{tytul}</span>
                )}
                <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{n.body}</p>
                <p className="mt-2 text-xs text-text-muted">
                  <RelativeTime iso={n.updatedAt} />
                </p>
              </div>
              <button
                onClick={() => usun.mutate(n.id)}
                title="Usuń notatkę"
                className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
