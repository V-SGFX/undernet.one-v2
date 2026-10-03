/**
 * Zamknięta lista ozdób nicku i awatara.
 *
 * Sedno: baza trzyma KLUCZ z tej listy, nigdy koloru ani stylu wpisanego
 * przez użytkownika. Dowolny CSS w nicku to nie kwestia gustu, tylko trzy
 * osobne dziury naraz — wstrzyknięcie skryptu, nick rozwalający układ
 * strony innym i nick nie do odczytania na ciemnym tle. Wygląd rozwijamy
 * dopiero na froncie, z klucza na gotowe klasy.
 */

export const KOLORY_NICKU = [
  'cyan', 'purple', 'pink', 'green', 'blue', 'yellow', 'orange', 'red',
] as const;

export const STYLE_NICKU = [
  'none',      // zwykły
  'glow',      // poświata w kolorze
  'gradient',  // przejście cyjan → fiolet
  'gradient-warm', // przejście żółty → róż
  'shimmer',   // animowany połysk
] as const;

export const OTOCZKI_AWATARA = [
  'none', 'cyan', 'purple', 'pink', 'green', 'gold', 'gradient', 'pulse',
] as const;

export type KolorNicku = (typeof KOLORY_NICKU)[number];
export type StylNicku = (typeof STYLE_NICKU)[number];
export type OtoczkaAwatara = (typeof OTOCZKI_AWATARA)[number];

/** Zwraca klucz, jeśli jest na liście; w przeciwnym razie `null`. */
export function dozwolony<T extends readonly string[]>(
  lista: T,
  wartosc: unknown,
): T[number] | null {
  const v = typeof wartosc === 'string' ? wartosc.trim() : '';
  if (!v || v === 'none') return null;
  return (lista as readonly string[]).includes(v) ? (v as T[number]) : null;
}

/**
 * Pola dokładane wszędzie, gdzie pokazujemy autora.
 *
 * `proUntil` jedzie razem z `isPro`, bo bez daty nie da się orzec, czy
 * abonament jeszcze trwa — a gwiazdka ma znaczyć „ma PRO teraz".
 */
export const OZDOBY_SELECT = {
  isPro: true,
  proUntil: true,
  nameColor: true,
  nameStyle: true,
  avatarRing: true,
} as const;

/** Autor pod wpisem, komentarzem, materiałem. */
export const AUTOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  ...OZDOBY_SELECT,
} as const;

/**
 * Pełny kształt „mojego konta".
 *
 * Jedno miejsce dla logowania, rejestracji i `/auth/me`. Wcześniej każde
 * z nich składało własny obiekt i logowanie zwracało sześć pól zamiast
 * kilkunastu — front hydratował formularz ustawień z tej ubogiej wersji
 * i pokazywał puste pola mimo wypełnionego profilu.
 */
export const PROFIL_KONTA_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  bio: true,
  website: true,
  location: true,
  bannerUrl: true,
  ...OZDOBY_SELECT,
} as const;

/** Te same pola, ale wybrane z już pobranego rekordu. */
export function profilKonta<T extends Record<string, any>>(user: T) {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(PROFIL_KONTA_SELECT)) out[k] = user[k] ?? null;
  return out;
}
