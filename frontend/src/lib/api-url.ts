/**
 * Skąd brać API — i dlaczego to dwie różne odpowiedzi.
 *
 * Ten sam kod wykonuje się w dwóch miejscach o zupełnie innym widoku sieci:
 *
 *  • Na SERWERZE (render, `generateMetadata`, sitemap, wstępne pobranie)
 *    najkrótsza droga to pętla zwrotna — `http://127.0.0.1:4100`. Bez TLS,
 *    bez nginksa, bez wychodzenia na zewnątrz.
 *
 *  • W PRZEGLĄDARCE ten sam adres oznacza komputer ODWIEDZAJĄCEGO. Żądanie
 *    albo trafia w nic, albo — jako zwykłe HTTP ze strony HTTPS — zostaje
 *    zablokowane jako treść mieszana, zanim w ogóle wyjdzie.
 *
 * Dokładnie to siedziało w `NEXT_PUBLIC_API_URL=http://127.0.0.1:4100`:
 * adres z prefiksem NEXT_PUBLIC_ jest WKOMPILOWYWANY w paczkę klienta, więc
 * pętla zwrotna serwera lądowała w oknie każdego użytkownika. Wszystko, co
 * pobierało dane po hydratacji — widok wątku, głosowanie, komentarze,
 * wyszukiwarka, kolejne strony list — kończyło się błędem sieci. Strona
 * wątku łapała go i przerzucała czytelnika na /discover, co wyglądało
 * dokładnie jak „nie działa".
 *
 * W przeglądarce używamy więc ścieżki względnej: nginx i tak proksuje
 * `/api/` do backendu, a to samo pochodzenie znosi przy okazji CORS
 * i działa na każdej domenie, pod którą serwis zostanie postawiony.
 */
const INTERNAL = process.env.INTERNAL_API_URL || 'http://127.0.0.1:4100';

/** Baza dla wywołań API. Pusty łańcuch w przeglądarce = to samo pochodzenie. */
export function apiOrigin(): string {
  if (typeof window === 'undefined') return INTERNAL;
  return process.env.NEXT_PUBLIC_API_URL || '';
}

/**
 * Adres pliku wgranego przez użytkownika.
 *
 * Ścieżki `/uploads/...` obsługuje backend, ale przez nginksa widać je pod
 * tą samą domeną — więc w przeglądarce zostawiamy je bez zmian. Doklejanie
 * czegokolwiek z przodu psuło je wcześniej podwójnie: raz pętlą zwrotną,
 * raz portem 4000, który należy do zupełnie innego serwisu.
 */
export function mediaUrl(src: string | null | undefined): string {
  if (!src) return '';
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) return src;
  if (!src.startsWith('/uploads')) return src;
  /*
   * ZAWSZE ścieżka względna — również przy renderowaniu na serwerze.
   *
   * Wcześniej po stronie serwera doklejany był adres wewnętrzny, przez co
   * w gotowym HTML lądowało `src="http://127.0.0.1:4100/uploads/…"`. To nie
   * jest adres, pod który przeglądarka odwiedzającego ma jak sięgnąć: to
   * pętla zwrotna JEGO komputera. Gorzej — przy `next/image` ten adres
   * trafia do optymalizatora jako źródło zewnętrzne, którego nie ma na
   * liście dozwolonych hostów, więc optymalizator odpowiada 400 i nie
   * pokazuje się ANI JEDNO zdjęcie: ani okładki, ani awatary, ani obrazki
   * w wątkach.
   *
   * Adres wewnętrzny jest potrzebny do POBIERANIA danych po stronie
   * serwera (`apiOrigin`), a nie do budowania adresów, które zobaczy
   * przeglądarka. To dwie różne rzeczy i tutaj mieszały się w jedną.
   */
  return src;
}
