/**
 * Rozwinięcie kluczy ozdób na klasy.
 *
 * Backend przechowuje sam klucz („purple", „gradient"), a wygląd powstaje
 * dopiero tutaj. Dzięki temu w bazie nigdy nie leży CSS napisany przez
 * użytkownika, a zmiana palety to jeden plik, nie migracja.
 */

export interface Ozdoby {
  isPro?: boolean;
  proUntil?: string | null;
  nameColor?: string | null;
  nameStyle?: string | null;
  avatarRing?: string | null;
}

/**
 * Czy konto ma PRO W TEJ CHWILI.
 *
 * Samo `isPro` nie wystarczy: pole zostaje ustawione, dopóki webhook nie
 * przyjdzie z wygaśnięciem, więc bez sprawdzenia daty gwiazdka wisiałaby
 * przy nicku jeszcze po końcu opłaconego okresu.
 */
export function maPro(u: Ozdoby | null | undefined): boolean {
  if (!u?.isPro) return false;
  if (!u.proUntil) return true;
  return new Date(u.proUntil) > new Date();
}

export const KOLORY: Record<string, string> = {
  cyan: 'text-neon-cyan',
  purple: 'text-neon-purple',
  pink: 'text-neon-pink',
  green: 'text-neon-green',
  blue: 'text-neon-blue',
  yellow: 'text-neon-yellow',
  orange: 'text-neon-orange',
  red: 'text-neon-red',
};

/** Podgląd kropki w wyborze koloru. */
export const KOLORY_TLO: Record<string, string> = {
  cyan: 'bg-neon-cyan',
  purple: 'bg-neon-purple',
  pink: 'bg-neon-pink',
  green: 'bg-neon-green',
  blue: 'bg-neon-blue',
  yellow: 'bg-neon-yellow',
  orange: 'bg-neon-orange',
  red: 'bg-neon-red',
};

export const POSWIATY: Record<string, string> = {
  cyan: 'text-glow-cyan',
  purple: 'text-glow-purple',
  pink: 'text-glow-pink',
  green: 'text-glow-green',
  blue: 'text-glow-cyan',
  yellow: 'text-glow-pink',
  orange: 'text-glow-pink',
  red: 'text-glow-pink',
};

export const STYLE: Record<string, string> = {
  gradient: 'bg-gradient-to-r from-neon-cyan to-neon-purple bg-clip-text text-transparent',
  'gradient-warm': 'bg-gradient-to-r from-neon-yellow to-neon-pink bg-clip-text text-transparent',
  shimmer: 'nick-shimmer',
};

export const OTOCZKI: Record<string, string> = {
  cyan: 'ring-2 ring-neon-cyan/70',
  purple: 'ring-2 ring-neon-purple/70',
  pink: 'ring-2 ring-neon-pink/70',
  green: 'ring-2 ring-neon-green/70',
  gold: 'ring-2 ring-neon-yellow/80',
  gradient: 'OPAKOWANIE',
  pulse: 'ring-2 ring-neon-cyan/70 otoczka-puls',
};

export const OPISY_STYLU: Record<string, string> = {
  none: 'Zwykły',
  glow: 'Poświata',
  gradient: 'Gradient',
  'gradient-warm': 'Gradient ciepły',
  shimmer: 'Połysk',
};

export const OPISY_OTOCZKI: Record<string, string> = {
  none: 'Brak',
  cyan: 'Cyjan',
  purple: 'Fiolet',
  pink: 'Róż',
  green: 'Zieleń',
  gold: 'Złoto',
  gradient: 'Gradient',
  pulse: 'Puls',
};

export const LISTA_KOLOROW = ['cyan', 'purple', 'pink', 'green', 'blue', 'yellow', 'orange', 'red'];
export const LISTA_STYLU = ['none', 'glow', 'gradient', 'gradient-warm', 'shimmer'];
export const LISTA_OTOCZEK = ['none', 'cyan', 'purple', 'pink', 'green', 'gold', 'gradient', 'pulse'];

/**
 * Czy pokazać ozdoby tego konta.
 *
 * Reguła MUSI być ta sama, co przy ustawianiu, bo inaczej wychodzi
 * absurd: przy wyłączonym przełączniku „Zaawansowane profile" każdy może
 * wybrać sobie kolor nicku, a nikt go nie widzi.
 *
 * `platne` mówi, czy funkcja jest w panelu przełączona na „wymaga PRO":
 *  • wyłączona → ozdoby widać u każdego, kto je sobie ustawił,
 *  • włączona  → tylko u kont z aktywnym PRO.
 *
 * Gwiazdka tego NIE dotyczy: ona zawsze znaczy „ma PRO teraz", niezależnie
 * od tego, które funkcje akurat są płatne.
 */
export function ozdobyWidoczne(u: Ozdoby | null | undefined, platne: boolean): boolean {
  return platne ? maPro(u) : true;
}

/**
 * Klasy nicku dla danego konta.
 *
 * `platne` domyślnie `false`, czyli „pokaż" — tak samo jak reszta kodu
 * zakłada dostęp, dopóki stan funkcji się nie wczyta. Miganie kolorem
 * jest łagodniejsze niż miganie brakiem koloru u kogoś, kto go ma.
 */
export function klasyNicku(u: Ozdoby | null | undefined, platne = false): string {
  if (!ozdobyWidoczne(u, platne)) return '';
  const kolor = u?.nameColor ?? '';
  const styl = u?.nameStyle ?? 'none';

  if (styl === 'gradient' || styl === 'gradient-warm' || styl === 'shimmer') {
    return STYLE[styl] ?? '';
  }
  const klasy = [KOLORY[kolor] ?? ''];
  if (styl === 'glow' && kolor) klasy.push(POSWIATY[kolor] ?? '');
  return klasy.filter(Boolean).join(' ');
}

export function klasyOtoczki(u: Ozdoby | null | undefined, platne = false): string {
  if (!ozdobyWidoczne(u, platne)) return '';
  const k = OTOCZKI[u?.avatarRing ?? ''] ?? '';
  return k === 'OPAKOWANIE' ? '' : k;
}

/**
 * Czy otoczka wymaga opakowania zamiast obwódki.
 *
 * Gradientowego pierścienia nie da się zrobić samym `ring-*`: `background-clip`
 * nie przebije się przez obrazek awatara. Taka otoczka powstaje z rodzica
 * z gradientem i wewnętrznym marginesem.
 */
export function otoczkaGradientowa(u: Ozdoby | null | undefined, platne = false): boolean {
  return ozdobyWidoczne(u, platne) && u?.avatarRing === 'gradient';
}
