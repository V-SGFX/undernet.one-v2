'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FolderOpen, Plus, Trash2, ChevronLeft, Lock, Loader2 } from 'lucide-react';
import { usePremium } from '@/lib/queries/premium';
import {
  useCollections, useCollection, useCollectionMutations,
} from '@/lib/queries/collections';
import { PATH_BY_TYPE, type ContentType } from '@/lib/queries/knowledge';

/**
 * Kolekcje w profilu.
 *
 * Dwa widoki w jednym komponencie: lista zbiorów i zawartość jednego.
 * Osobna trasa dla pojedynczej kolekcji byłaby czystsza, ale kolekcje są
 * prywatne — nie ma czego linkować ani indeksować, a powrót „wstecz"
 * z osobnej strony wyrzucałby z profilu.
 */
export function CollectionsWall() {
  const { data: premium } = usePremium();
  const { data: kolekcje, isLoading } = useCollections();
  const { utworz, usun, usunPozycje } = useCollectionMutations();
  const [otwarta, setOtwarta] = useState<number | null>(null);
  const [nowa, setNowa] = useState('');
  const [blad, setBlad] = useState<string | null>(null);

  const { data: szczegoly } = useCollection(otwarta);

  const platne = premium?.gated.includes('collections') ?? false;
  const mozeZakladac = !platne || (premium?.isPro ?? false);

  if (isLoading) return <p className="py-8 text-center text-sm text-text-muted">Wczytuję…</p>;

  // ── Zawartość jednej kolekcji ──
  if (otwarta && szczegoly) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setOtwarta(null)}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Wszystkie kolekcje
        </button>

        <div>
          <h3 className="text-lg font-bold text-text-primary">{szczegoly.name}</h3>
          {szczegoly.description && (
            <p className="mt-0.5 text-sm text-text-muted">{szczegoly.description}</p>
          )}
        </div>

        {szczegoly.items.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">
            Pusto. Dodawaj przyciskiem „Kolekcje" pod wątkiem albo materiałem.
          </p>
        )}

        <ul className="space-y-2">
          {szczegoly.items.map((i: any) => {
            const cel = i.post
              ? { href: `/posts/${i.post.id}`, tytul: i.post.title, rodzaj: i.post.community ? `c/${i.post.community.slug}` : 'wątek' }
              : { href: `/${PATH_BY_TYPE[i.contentItem.type as ContentType]}/${i.contentItem.slug}`,
                  tytul: i.contentItem.title, rodzaj: i.contentItem.type };
            return (
              <li key={i.id} className="card-neon flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <Link href={cel.href} className="block truncate font-medium text-text-primary hover:text-neon-cyan">
                    {cel.tytul}
                  </Link>
                  <p className="mt-0.5 text-2xs text-text-muted">
                    {cel.rodzaj}{i.note ? ` · ${i.note}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => usunPozycje.mutate({ collectionId: szczegoly.id, itemId: i.id })}
                  aria-label="Usuń z kolekcji"
                  className="shrink-0 text-text-muted transition-colors hover:text-neon-red"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── Lista kolekcji ──
  return (
    <div className="space-y-3">
      {mozeZakladac ? (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const name = nowa.trim();
            if (!name) return;
            setBlad(null);
            try {
              await utworz.mutateAsync({ name });
              setNowa('');
            } catch (err: any) {
              setBlad(err?.response?.data?.message ?? 'Nie udało się utworzyć.');
            }
          }}
        >
          <input
            value={nowa}
            onChange={(e) => setNowa(e.target.value)}
            placeholder="Nazwa nowej kolekcji…"
            className="min-w-0 flex-1 rounded-lg border border-border-default bg-dark-800 px-3 py-2 text-sm text-text-primary outline-none focus:border-neon-cyan/50"
          />
          <button
            type="submit"
            disabled={utworz.isPending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-neon-cyan/15 px-3 py-2 text-sm font-medium text-neon-cyan transition-colors hover:bg-neon-cyan/25 disabled:opacity-50"
          >
            {utworz.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
            Utwórz
          </button>
        </form>
      ) : (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          <Lock className="mr-1.5 inline h-3 w-3" aria-hidden="true" />
          Zakładanie kolekcji jest częścią UNDERNET PRO. Zapisane, które już masz, zostają dostępne.
        </div>
      )}

      {blad && <p className="text-sm text-neon-red">{blad}</p>}

      {(kolekcje ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          Nie masz jeszcze kolekcji. Kolekcja to nazwany zbiór — „Sieci domowe", „Do przeczytania”.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {(kolekcje ?? []).map((k) => (
            <li key={k.id} className="card-neon flex items-center gap-3 p-4">
              <FolderOpen className="h-4 w-4 shrink-0 text-neon-cyan" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setOtwarta(k.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate font-medium text-text-primary">{k.name}</span>
                <span className="text-2xs text-text-muted">{k._count?.items ?? 0} poz.</span>
              </button>
              <button
                type="button"
                onClick={() => usun.mutate(k.id)}
                aria-label={`Usuń kolekcję ${k.name}`}
                className="shrink-0 text-text-muted transition-colors hover:text-neon-red"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
