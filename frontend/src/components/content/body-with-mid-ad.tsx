'use client';

import { useMemo } from 'react';
import { AdSlot } from '@/components/ads/ad-slot';

/** Poniżej tylu znaków tekst jest za krótki, żeby cokolwiek w nim wstawiać. */
const PROG_DLUGOSCI = 2000;

/**
 * Treść materiału z blokiem reklamowym w połowie.
 *
 * Cięcie idzie po GRANICY AKAPITU, nie po liczbie znaków. Podział
 * w połowie łańcucha rozerwałby znacznik i zostawił niedomknięty element,
 * co przeglądarka „naprawia" po swojemu — zwykle wsuwając resztę tekstu
 * do środka poprzedniego akapitu.
 *
 * W krótkim haśle wiki bloku nie ma wcale: reklama po trzech zdaniach
 * rozbija jedną myśl na pół i wygląda na pomyłkę, a nie na przerwę.
 */
function podzielNaPolowie(html: string): [string, string] | null {
  if (!html || html.length < PROG_DLUGOSCI) return null;

  // Granice akapitów i sekcji — miejsca, w których wolno przerwać.
  const granice: number[] = [];
  const wzorzec = /<\/(p|ul|ol|pre|blockquote|table|figure)>/gi;
  let m: RegExpExecArray | null;
  while ((m = wzorzec.exec(html)) !== null) granice.push(m.index + m[0].length);

  // Mniej niż cztery bloki to tekst, w którym nie ma sensownej „połowy".
  if (granice.length < 4) return null;

  const srodek = html.length / 2;
  const ciecie = granice.reduce((a, b) => (Math.abs(b - srodek) < Math.abs(a - srodek) ? b : a));

  // Cięcie tuż przy początku albo końcu daje blok w złym miejscu.
  if (ciecie < html.length * 0.25 || ciecie > html.length * 0.75) return null;

  return [html.slice(0, ciecie), html.slice(ciecie)];
}

export function BodyWithMidAd({ html }: { html: string }) {
  const czesci = useMemo(() => podzielNaPolowie(html), [html]);

  if (!czesci) {
    return (
      <div
        className="prose-content mt-6 text-sm leading-relaxed text-content-secondary"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <>
      <div
        className="prose-content mt-6 text-sm leading-relaxed text-content-secondary"
        dangerouslySetInnerHTML={{ __html: czesci[0] }}
      />
      <AdSlot slotKey="content-mid" className="my-6 flex justify-center empty:hidden" />
      <div
        className="prose-content text-sm leading-relaxed text-content-secondary"
        dangerouslySetInnerHTML={{ __html: czesci[1] }}
      />
    </>
  );
}
