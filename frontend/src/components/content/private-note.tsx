'use client';

import { useEffect, useState } from 'react';
import { NotebookPen, Lock, Check, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { usePremium, useProWidoczne } from '@/lib/queries/premium';
import { useNote, useNoteMutations } from '@/lib/queries/notes';

/**
 * Prywatna notatka przypięta do materiału lub wątku.
 *
 * Zwinięta domyślnie i podpisana „widzisz tylko Ty" — bo bez tego napisu
 * pole tekstowe pod artykułem czyta się jak komentarz, a to jest dokładnie
 * ta pomyłka, której nie da się cofnąć.
 */
export function PrivateNote({
  postId,
  contentItemId,
}: {
  postId?: number;
  contentItemId?: number;
}) {
  const { user } = useAuth();
  const { data: premium } = usePremium();
  const proWidoczne = useProWidoczne();
  const [otwarte, setOtwarte] = useState(false);
  const [tresc, setTresc] = useState('');
  const [zapisane, setZapisane] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const platne = premium?.gated.includes('private-notes') ?? false;
  const dostepne = !platne || (premium?.isPro ?? false);

  const { data: notatka, isLoading } = useNote({ postId, contentItemId }, Boolean(user) && otwarte);
  const { zapisz } = useNoteMutations();

  // Treść z serwera wjeżdża do pola dopiero, gdy zapytanie wróci.
  useEffect(() => {
    if (notatka) setTresc(notatka.body);
  }, [notatka?.id, notatka?.body]);

  if (!user) return null;

  const zapiszTeraz = async () => {
    setBlad(null);
    setZapisane(false);
    try {
      await zapisz.mutateAsync({ postId, contentItemId, body: tresc });
      setZapisane(true);
      setTimeout(() => setZapisane(false), 2000);
    } catch (e: any) {
      setBlad(e?.response?.data?.message ?? 'Nie udało się zapisać notatki.');
    }
  };

  const maNotatke = Boolean(notatka?.body);

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        onClick={() => setOtwarte((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-300 hover:text-white"
      >
        <NotebookPen className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="font-medium">Prywatna notatka</span>
        {maNotatke && !otwarte && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">
            zapisana
          </span>
        )}
        {!dostepne && <Lock className="h-3.5 w-3.5 text-amber-500/70" />}
        <span className="ml-auto text-xs text-zinc-600">{otwarte ? 'zwiń' : 'rozwiń'}</span>
      </button>

      {otwarte && (
        <div className="border-t border-white/10 px-4 py-3">
          {!dostepne ? (
            <p className="text-sm text-zinc-400">
              Prywatne notatki są częścią{' '}
              {proWidoczne ? (
                <a href="/pro" className="text-emerald-400 hover:underline">UNDERNET PRO</a>
              ) : (
                <span className="text-emerald-400">UNDERNET PRO</span>
              )}
              .
            </p>
          ) : isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
          ) : (
            <>
              <textarea
                value={tresc}
                onChange={(e) => setTresc(e.target.value)}
                rows={4}
                maxLength={5000}
                placeholder="Co chcesz zapamiętać z tego materiału?"
                className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={zapiszTeraz}
                  disabled={zapisz.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {zapisz.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : zapisane ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
                  {zapisane ? 'Zapisano' : 'Zapisz'}
                </button>
                {maNotatke && tresc.trim() === '' && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-500/80">
                    <Trash2 className="h-3 w-3" />
                    Pusta treść usunie notatkę
                  </span>
                )}
                <span className="ml-auto text-xs text-zinc-600">Widzisz tylko Ty</span>
              </div>
              {blad && <p className="mt-2 text-xs text-red-400">{blad}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
