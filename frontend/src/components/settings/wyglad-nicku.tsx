'use client';

import { Star, Lock } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { useProWidoczne } from '@/lib/queries/premium';
import {
  LISTA_KOLOROW, LISTA_STYLU, LISTA_OTOCZEK,
  KOLORY_TLO, OPISY_STYLU, OPISY_OTOCZKI,
  klasyNicku, klasyOtoczki, otoczkaGradientowa,
} from '@/lib/ozdoby';

/**
 * Wybór ozdób nicku i awatara.
 *
 * Podgląd stoi na górze i zmienia się przy każdym kliknięciu, zanim
 * cokolwiek pójdzie na serwer — kolor nicku to decyzja czysto wzrokowa
 * i ocenia się ją okiem, a nie po nazwie „gradient ciepły".
 */
export function WygladNicku({
  nazwa,
  avatarUrl,
  kolor,
  styl,
  otoczka,
  dostepne,
  maPro,
  onKolor,
  onStyl,
  onOtoczka,
}: {
  nazwa: string;
  avatarUrl: string | null;
  kolor: string;
  styl: string;
  otoczka: string;
  dostepne: boolean;
  /** Czy konto NAPRAWDĘ ma PRO — od tego zależy gwiazdka, nie od ozdób. */
  maPro: boolean;
  onKolor: (v: string) => void;
  onStyl: (v: string) => void;
  onOtoczka: (v: string) => void;
}) {
  // Podgląd udaje aktywne PRO, bo pokazuje, jak BĘDZIE wyglądać.
  const proWidoczne = useProWidoczne();

  const udawane = {
    isPro: true,
    proUntil: null,
    nameColor: kolor,
    nameStyle: styl,
    avatarRing: otoczka,
  };

  return (
    <div className="space-y-5 border-t border-white/10 pt-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        Wygląd nicku
        {!dostepne && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-normal text-amber-400">
            <Lock className="h-3 w-3" /> UNDERNET PRO
          </span>
        )}
      </div>

      {/* ── Podgląd ── */}
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
        <Avatar src={avatarUrl} name={nazwa} size="md" ozdoby={udawane} />
        <span className="inline-flex items-baseline gap-1">
          <span className={`text-base font-semibold ${klasyNicku(udawane) || 'text-text-primary'}`}>
            {nazwa}
          </span>
          {maPro && (
            <Star className="h-3.5 w-3.5 self-center fill-neon-yellow text-neon-yellow" />
          )}
        </span>
        <span className="ml-auto text-[11px] text-text-muted">
          {maPro ? 'podgląd' : 'podgląd · gwiazdka po wykupieniu PRO'}
        </span>
      </div>

      {!dostepne ? (
        <p className="text-sm text-text-secondary">
          Kolor nicku, styl i otoczka awatara są częścią{' '}
          {proWidoczne ? (
            <Link href="/pro" className="text-neon-green hover:underline">UNDERNET PRO</Link>
          ) : (
            <span className="text-neon-green">UNDERNET PRO</span>
          )}.
          Gwiazdka przy nicku pojawia się sama, gdy PRO jest aktywne.
        </p>
      ) : (
        <>
          <div>
            <p className="mb-2 text-sm text-text-secondary">Kolor</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onKolor('')}
                className={`h-8 rounded-lg border px-3 text-xs transition-colors ${
                  !kolor
                    ? 'border-white/40 text-text-primary'
                    : 'border-white/10 text-text-muted hover:text-text-primary'
                }`}
              >
                Domyślny
              </button>
              {LISTA_KOLOROW.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => onKolor(k)}
                  aria-label={`Kolor ${k}`}
                  aria-pressed={kolor === k}
                  className={`h-8 w-8 rounded-lg border transition-transform hover:scale-110 ${
                    kolor === k ? 'border-white/60 scale-110' : 'border-white/10'
                  }`}
                >
                  <span className={`block h-full w-full rounded-[7px] ${KOLORY_TLO[k]}`} />
                </button>
              ))}
            </div>
            {(styl === 'gradient' || styl === 'gradient-warm' || styl === 'shimmer') && (
              <p className="mt-2 text-xs text-text-muted">
                Wybrany styl ma własne barwy — kolor wróci po zmianie na zwykły lub poświatę.
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm text-text-secondary">Styl</p>
            <div className="flex flex-wrap gap-2">
              {LISTA_STYLU.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onStyl(v)}
                  aria-pressed={styl === v}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    styl === v
                      ? 'border-neon-green/50 bg-neon-green/10 text-neon-green'
                      : 'border-white/10 text-text-muted hover:text-text-primary'
                  }`}
                >
                  {OPISY_STYLU[v]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-text-secondary">Otoczka awatara</p>
            <div className="flex flex-wrap gap-2">
              {LISTA_OTOCZEK.map((v) => {
                const probka = { isPro: true, proUntil: null, avatarRing: v };
                const gradient = otoczkaGradientowa(probka);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onOtoczka(v)}
                    aria-pressed={otoczka === v}
                    title={OPISY_OTOCZKI[v]}
                    className={`rounded-lg border p-1.5 transition-colors ${
                      otoczka === v
                        ? 'border-neon-green/50 bg-neon-green/10'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    <span
                      className={`block h-7 w-7 rounded-full ${
                        gradient
                          ? 'bg-gradient-to-br from-neon-cyan via-neon-purple to-neon-pink'
                          : `bg-dark-700 ${klasyOtoczki(probka)}`
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
