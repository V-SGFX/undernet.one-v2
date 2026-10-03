'use client';

import { useState } from 'react';
import { FolderPlus, Check, Lock, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { usePremium } from '@/lib/queries/premium';
import { useCollections, useWhereIs, useCollectionMutations } from '@/lib/queries/collections';

/**
 * „Dodaj do kolekcji" — warstwa nad zakładką.
 *
 * Zakładka („Zapisz") odpowiada na pytanie „wrócę do tego"; kolekcja na
 * „gdzie to należy". To dwie różne decyzje i dlatego są dwoma osobnymi
 * przyciskami, a nie jednym z rozwijaną listą.
 *
 * Lista otwiera się z już zaznaczonymi kolekcjami, w których rzecz leży —
 * inaczej trzeba by pamiętać, gdzie się ją wcześniej wrzuciło.
 */
export function AddToCollection({
  postId,
  contentItemId,
}: {
  postId?: number;
  contentItemId?: number;
}) {
  const { user } = useAuth();
  const { data: premium } = usePremium();
  const [otwarte, setOtwarte] = useState(false);
  const [nowa, setNowa] = useState('');
  const [blad, setBlad] = useState<string | null>(null);

  const platne = premium?.gated.includes('collections') ?? false;
  const dostepne = !platne || (premium?.isPro ?? false);

  const { data: kolekcje } = useCollections(Boolean(user) && otwarte);
  const { data: gdzie } = useWhereIs({ postId, contentItemId }, Boolean(user) && otwarte);
  const { utworz, dodajPozycje, usunPozycje } = useCollectionMutations();

  if (!user) return null;

  const wKolekcji = (id: number) => (gdzie ?? []).includes(id);

  const przelacz = async (collectionId: number) => {
    setBlad(null);
    try {
      if (wKolekcji(collectionId)) {
        // Do usunięcia potrzebny numer pozycji, nie kolekcji — bierzemy go
        // z zawartości, bo lista „gdzie-jest" zwraca same kolekcje.
        const { data } = await (await import('@/lib/api')).api.get(`/collections/${collectionId}`);
        const poz = data.items.find((i: any) =>
          postId ? i.postId === postId : i.contentItemId === contentItemId);
        if (poz) await usunPozycje.mutateAsync({ collectionId, itemId: poz.id });
      } else {
        await dodajPozycje.mutateAsync({ collectionId, postId, contentItemId });
      }
    } catch (e: any) {
      setBlad(e?.response?.data?.message ?? 'Nie udało się zapisać.');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOtwarte((v) => !v)}
        aria-expanded={otwarte}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-text-muted transition-colors hover:bg-dark-700 hover:text-text-primary"
      >
        {dostepne ? <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
        <span className="text-xs">Kolekcje</span>
      </button>

      {otwarte && (
        <div className="absolute left-0 z-dropdown mt-2 w-72 rounded-xl border border-white/[0.08] bg-dark-800 p-3 shadow-xl">
          {!dostepne ? (
            <p className="text-xs text-white/60">
              Kolekcje są częścią <strong className="text-white/80">UNDERNET PRO</strong>.
              Zakładka „Zapisz" działa bez niego.
            </p>
          ) : (
            <>
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {(kolekcje ?? []).length === 0 && (
                  <p className="px-1 py-2 text-xs text-white/40">
                    Nie masz jeszcze żadnej kolekcji.
                  </p>
                )}
                {(kolekcje ?? []).map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => przelacz(k.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-white/80 transition-colors hover:bg-white/[0.06]"
                  >
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                        wKolekcji(k.id)
                          ? 'border-neon-cyan bg-neon-cyan text-black'
                          : 'border-white/20'
                      }`}
                    >
                      {wKolekcji(k.id) && <Check className="h-3 w-3" aria-hidden="true" />}
                    </span>
                    <span className="truncate">{k.name}</span>
                    <span className="ml-auto text-2xs text-white/30">{k._count?.items ?? 0}</span>
                  </button>
                ))}
              </div>

              <form
                className="mt-2 flex gap-1.5 border-t border-white/[0.06] pt-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = nowa.trim();
                  if (!name) return;
                  setBlad(null);
                  try {
                    const k = await utworz.mutateAsync({ name });
                    setNowa('');
                    await dodajPozycje.mutateAsync({ collectionId: k.id, postId, contentItemId });
                  } catch (e: any) {
                    setBlad(e?.response?.data?.message ?? 'Nie udało się utworzyć.');
                  }
                }}
              >
                <input
                  value={nowa}
                  onChange={(e) => setNowa(e.target.value)}
                  placeholder="Nowa kolekcja…"
                  className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-neon-cyan/50"
                />
                <button
                  type="submit"
                  disabled={utworz.isPending}
                  aria-label="Utwórz kolekcję i dodaj"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-neon-cyan/15 text-neon-cyan transition-colors hover:bg-neon-cyan/25 disabled:opacity-50"
                >
                  {utworz.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              </form>
            </>
          )}

          {blad && <p className="mt-2 text-xs text-neon-red">{blad}</p>}
        </div>
      )}
    </div>
  );
}
