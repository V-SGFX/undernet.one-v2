import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PremiumFeature {
  key: string;
  name: string;
  description: string | null;
  requiresPremium: boolean;
  position: number;
}

interface PremiumState {
  features: PremiumFeature[];
  /** Klucze funkcji, które wymagają wykupionego PRO. */
  gated: string[];
  isPro: boolean;
  /** Czy w ogóle ogłaszamy PRO: przycisk w pasku i strona /pro. */
  proWidoczne: boolean;
}

/**
 * Stan UNDERNET PRO dla bieżącego odwiedzającego.
 *
 * Jedno zapytanie na całą stronę, nie jedno na funkcję. Krótki czas
 * świeżości, bo przełącznik w panelu ma działać od razu — a to lista
 * ośmiu wierszy, nie coś, co warto oszczędzać.
 */
export function usePremium() {
  return useQuery({
    queryKey: ['premium', 'features'],
    queryFn: async (): Promise<PremiumState> => {
      const { data } = await api.get('/premium/features');
      return data;
    },
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Czy odwiedzający MOŻE SKORZYSTAĆ z funkcji.
 *
 * Dla funkcji typu „dostęp": kolekcje, alerty, zaawansowane wyszukiwanie.
 * Nieoznaczona jako płatna jest dostępna dla wszystkich, także
 * niezalogowanych. Dopóki dane się nie wczytają, zakładamy dostęp — gorzej
 * mignąć funkcją i ją schować niż migać kłódką na czymś darmowym.
 */
export function useFeature(key: string): boolean {
  const { data } = usePremium();
  if (!data) return true;
  if (!data.gated.includes(key)) return true;
  return data.isPro;
}

/**
 * Czy odwiedzającemu przysługuje PRZYWILEJ przez odjęcie.
 *
 * Osobno od `useFeature`, bo „brak reklam" działa odwrotnie niż reszta:
 * to nie jest coś, co się włącza, tylko coś, co się KOMUŚ ZABIERA.
 *
 * Gdyby liczyć go jak dostęp, wyłączenie przełącznika („dostępne dla
 * wszystkich") oznaczałoby, że każdy dostaje brak reklam — czyli reklamy
 * znikają CAŁKOWICIE, razem z przychodem. Przywilej ma sens wyłącznie
 * wtedy, gdy jest płatny i gdy ktoś go wykupił.
 */
export function useProPerk(key: string): boolean {
  const { data } = usePremium();
  if (!data) return false;
  return data.gated.includes(key) && data.isPro;
}

/**
 * Czy ozdoby profilu są dziś zarezerwowane dla PRO.
 *
 * Jedno pytanie na całą stronę — react-query scala je do jednego
 * zapytania niezależnie od tego, ile nicków akurat jest na ekranie.
 * Dopóki stan się nie wczyta, zakładamy „nie zarezerwowane", spójnie
 * z `useFeature`.
 */
export function useOzdobyPlatne(): boolean {
  const { data } = usePremium();
  return data?.gated.includes('advanced-profile') ?? false;
}

/**
 * Czy pokazywać cokolwiek o UNDERNET PRO.
 *
 * Domyślnie `false`, dopóki odpowiedź nie dojdzie — odwrotnie niż przy
 * dostępie do funkcji. Tam miganie jest niegroźne, tu przez ułamek sekundy
 * migałby przycisk zakupu oferty, którą świadomie schowano.
 */
export function useProWidoczne(): boolean {
  const { data } = usePremium();
  return data?.proWidoczne ?? false;
}
