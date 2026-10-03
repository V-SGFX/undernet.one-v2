import {
  Ban, UserRound, FolderOpen, NotebookPen, BellRing,
  SearchCheck, Radar, Users, Sparkles, type LucideIcon,
} from 'lucide-react';

/**
 * Oprawa ośmiu funkcji PRO.
 *
 * Nazwy i opisy nadal przychodzą z panelu — tu dokładamy tylko ikonę,
 * kolor i jedno zdanie „co to realnie daje". Gdyby kiedyś doszedł klucz,
 * którego tu nie ma, karta i tak się wyrysuje: `DOMYSLNA` łapie resztę,
 * więc nowa funkcja nie zniknie ze strony przez zapomniany wpis.
 */
export interface Oprawa {
  icon: LucideIcon;
  kolor: string;   // klasa tekstu
  tlo: string;     // klasa tła kafelka ikony
  obwodka: string; // klasa obwódki przy najechaniu
  poswiata: string; // klasa cienia tekstu pod ikoną
  kreska: string;  // klasa gradientu górnej kreski
  zdanie: string;
}

export const DOMYSLNA: Oprawa = {
  icon: Sparkles,
  kolor: 'text-neon-cyan',
  tlo: 'bg-neon-cyan/10',
  obwodka: 'group-hover:border-neon-cyan/40',
  poswiata: 'text-glow-cyan',
  kreska: 'via-neon-cyan/60',
  zdanie: '',
};

export const OPRAWA: Record<string, Oprawa> = {
  'no-ads': {
    icon: Ban,
    kolor: 'text-neon-red',
    tlo: 'bg-neon-red/10',
    obwodka: 'group-hover:border-neon-red/40',
    poswiata: '',
    kreska: 'via-neon-red/60',
    zdanie: 'Żadnych bloków reklamowych. Zostaje treść, po którą przyszedłeś.',
  },
  'advanced-profile': {
    icon: UserRound,
    kolor: 'text-neon-purple',
    tlo: 'bg-neon-purple/10',
    obwodka: 'group-hover:border-neon-purple/40',
    poswiata: 'text-glow-purple',
    kreska: 'via-neon-purple/60',
    zdanie: 'Gwiazdka przy nicku, własny kolor i styl nazwy, otoczka awatara oraz opis, odnośnik i lokalizacja w profilu.',
  },
  collections: {
    icon: FolderOpen,
    kolor: 'text-neon-cyan',
    tlo: 'bg-neon-cyan/10',
    obwodka: 'group-hover:border-neon-cyan/40',
    poswiata: 'text-glow-cyan',
    kreska: 'via-neon-cyan/60',
    zdanie: 'Własne półki na materiały i wątki. Zakładka mówi „wrócę tu”, kolekcja — „gdzie to należy”.',
  },
  'private-notes': {
    icon: NotebookPen,
    kolor: 'text-neon-green',
    tlo: 'bg-neon-green/10',
    obwodka: 'group-hover:border-neon-green/40',
    poswiata: 'text-glow-green',
    kreska: 'via-neon-green/60',
    zdanie: 'Notatka przypięta do materiału, widoczna wyłącznie dla Ciebie. Nigdy nie staje się komentarzem.',
  },
  alerts: {
    icon: BellRing,
    kolor: 'text-neon-yellow',
    tlo: 'bg-neon-yellow/10',
    obwodka: 'group-hover:border-neon-yellow/40',
    poswiata: '',
    kreska: 'via-neon-yellow/60',
    zdanie: 'Pilnujemy Twojej frazy co kwadrans i dajemy znać, gdy ktoś o niej napisze.',
  },
  'advanced-search': {
    icon: SearchCheck,
    kolor: 'text-neon-blue',
    tlo: 'bg-neon-blue/10',
    obwodka: 'group-hover:border-neon-blue/40',
    poswiata: '',
    kreska: 'via-neon-blue/60',
    zdanie: 'Filtry po autorze, kategorii, dacie i typie — zamiast przewijania wyników.',
  },
  'topic-monitoring': {
    icon: Radar,
    kolor: 'text-neon-orange',
    tlo: 'bg-neon-orange/10',
    obwodka: 'group-hover:border-neon-orange/40',
    poswiata: '',
    kreska: 'via-neon-orange/60',
    zdanie: 'Raz na dobę krótkie podsumowanie z obserwowanych tagów i społeczności.',
  },
  'community-extras': {
    icon: Users,
    kolor: 'text-neon-pink',
    tlo: 'bg-neon-pink/10',
    obwodka: 'group-hover:border-neon-pink/40',
    poswiata: 'text-glow-pink',
    kreska: 'via-neon-pink/60',
    zdanie: 'Więcej miejsca na własne społeczności: dwadzieścia zamiast dwóch.',
  },
};
