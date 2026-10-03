'use client';

import { Lock, SlidersHorizontal, X } from 'lucide-react';
import { useCategories } from '@/lib/queries/knowledge';
import { usePremium } from '@/lib/queries/premium';

export interface Filtry {
  typ: string;
  kategoria: string;
  od: string;
  do: string;
  wTresci: boolean;
}

export const PUSTE_FILTRY: Filtry = { typ: '', kategoria: '', od: '', do: '', wTresci: false };

export function czyPuste(f: Filtry): boolean {
  return !f.typ && !f.kategoria && !f.od && !f.do && !f.wTresci;
}

const TYPY = [
  { v: '', label: 'Wszystkie' },
  { v: 'WIKI', label: 'Wiki' },
  { v: 'HOWTO', label: 'How To' },
  { v: 'ARTICLE', label: 'Artykuły' },
  { v: 'NEWS', label: 'News' },
];

/**
 * Zawężanie wyników — część UNDERNET PRO.
 *
 * Bez filtrów wyszukiwarka szukała po tytule i zajawce, i na tym koniec.
 * Na portalu, gdzie ta sama nazwa narzędzia pada w haśle wiki, w instrukcji
 * i w trzech wątkach, „szukaj" bez zawężenia zwraca wszystko naraz — czyli
 * w praktyce nic.
 *
 * Gdy funkcja jest płatna, a konto jej nie ma, panel POKAZUJE SIĘ, ale
 * zablokowany. Ukrycie go byłoby wygodniejsze w kodzie i gorsze dla
 * użytkownika: nie dałoby się zauważyć, że coś takiego w ogóle istnieje.
 */
export function SearchFilters({
  wartosci,
  onChange,
}: {
  wartosci: Filtry;
  onChange: (f: Filtry) => void;
}) {
  const { data: premium } = usePremium();
  const { data: kategorie } = useCategories();

  const platne = premium?.gated.includes('advanced-search') ?? false;
  const dostepne = !platne || (premium?.isPro ?? false);

  const set = <K extends keyof Filtry>(k: K, v: Filtry[K]) => onChange({ ...wartosci, [k]: v });

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-white/40" aria-hidden="true" />
        <span className="text-sm font-medium text-white/70">Zawęź wyniki</span>

        {!dostepne && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-2xs font-semibold text-amber-400">
            <Lock className="h-3 w-3" aria-hidden="true" />
            UNDERNET PRO
          </span>
        )}
        {dostepne && !czyPuste(wartosci) && (
          <button
            type="button"
            onClick={() => onChange(PUSTE_FILTRY)}
            className="ml-auto inline-flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-white/70"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Wyczyść
          </button>
        )}
      </div>

      <fieldset disabled={!dostepne} className="space-y-3 disabled:opacity-50">
        <div className="flex flex-wrap gap-1.5">
          {TYPY.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => set('typ', t.v)}
              aria-pressed={wartosci.typ === t.v}
              className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                wartosci.typ === t.v
                  ? 'border-neon-cyan/50 text-neon-cyan'
                  : 'border-white/[0.08] text-white/50 hover:text-white/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-2xs uppercase tracking-wide text-white/35">Kategoria</span>
            <select
              value={wartosci.kategoria}
              onChange={(e) => set('kategoria', e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/50"
            >
              <option value="">Wszystkie</option>
              {(kategorie ?? []).map((k) => (
                <option key={k.id} value={k.slug}>{k.name}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-2xs uppercase tracking-wide text-white/35">Od</span>
              <input
                type="date"
                value={wartosci.od}
                onChange={(e) => set('od', e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-2 py-2 text-sm text-white outline-none focus:border-neon-cyan/50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-2xs uppercase tracking-wide text-white/35">Do</span>
              <input
                type="date"
                value={wartosci.do}
                onChange={(e) => set('do', e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-2 py-2 text-sm text-white outline-none focus:border-neon-cyan/50"
              />
            </label>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={wartosci.wTresci}
            onChange={(e) => set('wTresci', e.target.checked)}
            className="h-3.5 w-3.5 accent-neon-cyan"
          />
          Szukaj także w pełnej treści, nie tylko w tytule i zajawce
        </label>
      </fieldset>

      {!dostepne && (
        <p className="mt-3 text-xs text-white/40">
          Filtrowanie wyników jest częścią UNDERNET PRO. Samo wyszukiwanie działa bez niego.
        </p>
      )}
    </div>
  );
}
