'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Tag {
  id: number;
  slug: string;
  name: string;
}

/**
 * Wybór tagów materiału.
 *
 * Tag odpowiada na pytanie „czego to dotyczy", kategoria na „w której
 * półce stoi" — dlatego tagi przecinają kategorie i jeden materiał ma
 * ich zwykle kilka.
 *
 * Zakładanie nowego tagu jest możliwe, ale schowane za wpisaniem nazwy,
 * której nie ma na liście. Gdyby stało obok pola wyboru jako równorzędna
 * opcja, przy każdym materiale powstawałby nowy tag na jedno użycie —
 * a tag, pod którym leży jedna rzecz, nie prowadzi nigdzie.
 */
export function TagsField({
  value,
  onChange,
  disabled = false,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const [szukaj, setSzukaj] = useState('');
  const [tworze, setTworze] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: tagi, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: async (): Promise<Tag[]> => (await api.get('/tags')).data,
    staleTime: 60_000,
  });

  const wybrane = useMemo(
    () => (tagi ?? []).filter((t) => value.includes(t.id)),
    [tagi, value],
  );

  const fraza = szukaj.trim().toLowerCase();

  const podpowiedzi = useMemo(() => {
    const wolne = (tagi ?? []).filter((t) => !value.includes(t.id));
    if (!fraza) return wolne.slice(0, 12);
    return wolne.filter((t) => t.name.includes(fraza) || t.slug.includes(fraza)).slice(0, 12);
  }, [tagi, value, fraza]);

  // Propozycja założenia pojawia się dopiero, gdy nic nie pasuje —
  // i tylko dla nazwy, której naprawdę nie ma wśród istniejących.
  const mozeUtworzyc =
    fraza.length >= 2 &&
    !(tagi ?? []).some((t) => t.name === fraza || t.slug === fraza);

  const dodaj = (id: number) => {
    onChange([...value, id]);
    setSzukaj('');
  };

  const usun = (id: number) => onChange(value.filter((x) => x !== id));

  const utworz = async () => {
    setBlad(null);
    setTworze(true);
    try {
      const { data } = await api.post('/tags', { name: fraza });
      // Lista tagów jest w pamięci podręcznej po obu stronach — serwer
      // czyści swoją przy tworzeniu, my musimy swoją.
      await queryClient.invalidateQueries({ queryKey: ['tags'] });
      onChange([...value, data.id]);
      setSzukaj('');
    } catch (e: any) {
      setBlad(e?.response?.data?.message ?? 'Nie udało się utworzyć tagu.');
    } finally {
      setTworze(false);
    }
  };

  return (
    <div>
      {wybrane.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {wybrane.map((t) => (
            <li key={t.id}>
              <span className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1 text-2xs text-accent">
                #{t.name}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => usun(t.id)}
                    aria-label={`Usuń tag ${t.name}`}
                    className="rounded hover:text-content-primary"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <>
          <input
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
            placeholder="Wpisz, żeby wyszukać tag…"
            className="w-full rounded-lg border border-line bg-surface-base px-3 py-2 text-sm text-content-primary placeholder:text-content-muted"
          />

          {isLoading ? (
            <p className="mt-2 flex items-center gap-1.5 text-2xs text-content-muted">
              <Loader2 className="h-3 w-3 animate-spin" /> Wczytywanie tagów…
            </p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {podpowiedzi.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => dodaj(t.id)}
                    className="rounded-lg border border-line px-2 py-1 text-2xs text-content-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    #{t.name}
                  </button>
                </li>
              ))}

              {mozeUtworzyc && (
                <li>
                  <button
                    type="button"
                    onClick={utworz}
                    disabled={tworze}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-accent/50 px-2 py-1 text-2xs text-accent disabled:opacity-50"
                  >
                    {tworze ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Utwórz „{fraza}"
                  </button>
                </li>
              )}

              {podpowiedzi.length === 0 && !mozeUtworzyc && (
                <li className="text-2xs text-content-muted">Brak pasujących tagów.</li>
              )}
            </ul>
          )}

          {blad && <p className="mt-1 text-2xs text-live">{blad}</p>}
        </>
      )}

      {disabled && wybrane.length === 0 && (
        <p className="text-2xs text-content-muted">Brak tagów.</p>
      )}
    </div>
  );
}
