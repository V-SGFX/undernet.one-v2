/**
 * robots.txt — wraz z zastrzeżeniem praw wobec systemów AI.
 *
 * Dlaczego trasa, a nie `app/robots.ts`: konwencja metadanych w Next
 * generuje wyłącznie `User-Agent`, `Allow`, `Disallow` i `Sitemap`.
 * Nie da się nią wypisać `Content-Signal`, a to właśnie ta linijka niesie
 * tu treść prawną. Zwykła trasa oddaje plik dosłownie, więc mamy pełną
 * kontrolę nad każdym wierszem.
 *
 * ═══ CZEGO TEN PLIK NIE ROBI ═══
 *
 * `robots.txt` to PROŚBA, nie zamek. Przestrzegają jej roboty, które
 * chcą przestrzegać — i tylko one. Scraper napisany wieczorem przez
 * kogoś, kto ten plik zignoruje, przejdzie tędy bez żadnego oporu.
 *
 * Realne wymuszenie siedzi warstwę wyżej, w Cloudflare, przez który
 * i tak idzie cały ruch: przełącznik „Block AI Scrapers and Crawlers"
 * plus ograniczenie liczby żądań. Ten plik jest oświadczeniem woli
 * i podstawą prawną — nie zabezpieczeniem technicznym. Mylenie tych
 * dwóch rzeczy kończy się fałszywym poczuciem, że temat jest załatwiony.
 */
export const dynamic = 'force-static';

const DOMENA = 'https://undernet.one';

/**
 * Ścieżki poza indeksem — dla WSZYSTKICH robotów, także tych dobrych.
 *
 * To nie jest ochrona przed AI, tylko higiena wyszukiwarki: nie ma sensu
 * indeksować panelu, ustawień ani punktów końcowych API.
 */
const POZA_INDEKSEM = [
  '/api/',
  '/admin/',
  '/admin-panel/',
  '/settings/',
  '/notifications/',
  '/dashboard/',
  '/auth/',
  '/profile/',
];

/**
 * Roboty odcięte od całego serwisu.
 *
 * Lista celowo NIE zawiera zwykłych robotów wyszukiwarek — Googlebot,
 * Bingbot i Applebot mają wchodzić, bo z wyszukiwarek przychodzą ludzie.
 * Odcinamy wyłącznie te, które zbierają treść na potrzeby modeli:
 *
 *  • `Google-Extended` i `Applebot-Extended` to OSOBNE zgody na trenowanie,
 *    niezależne od indeksowania. Zablokowanie ich nie rusza pozycji
 *    w wynikach wyszukiwania — i o to chodzi.
 *  • Agenty z końcówką `-User` (ChatGPT-User, Perplexity-User) chodzą
 *    na żądanie człowieka, nie zbierają hurtem. Blokujemy je mimo to,
 *    bo skoro treść ma nie zasilać odpowiedzi modeli, to niezależnie od
 *    tego, kto nacisnął przycisk.
 */
const ROBOTY_AI = [
  // OpenAI
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  // Anthropic
  'anthropic-ai', 'ClaudeBot', 'Claude-Web', 'Claude-User', 'Claude-SearchBot',
  // Google / Apple — osobne zgody na trenowanie
  'Google-Extended', 'Google-CloudVertexBot', 'Applebot-Extended',
  // Meta
  'FacebookBot', 'Meta-ExternalAgent', 'meta-externalagent', 'Meta-ExternalFetcher',
  // Common Crawl i zbiory treningowe
  'CCBot', 'AI2Bot', 'Ai2Bot-Dolma', 'img2dataset', 'omgili', 'Omgilibot',
  // Wyszukiwarki oparte na modelach
  'PerplexityBot', 'Perplexity-User', 'YouBot', 'DuckAssistBot',
  // Pozostali dostawcy modeli
  'cohere-ai', 'cohere-training-data-crawler', 'MistralAI-User', 'PanguBot',
  // Zbieracze i pośrednicy
  'Bytespider', 'TikTokSpider', 'Amazonbot', 'Diffbot', 'Timpibot',
  'Webzio-Extended', 'ImagesiftBot', 'Kangaroo Bot', 'Sidetrade indexer bot',
  'CloudflareBrowserRenderingCrawler',
  // Narzędzia, którymi pisze się scrapery
  'Scrapy',
];

export function GET() {
  const linie: string[] = [];

  linie.push('# ─────────────────────────────────────────────────────────────');
  linie.push('# UNDERNET.ONE');
  linie.push('#');
  linie.push('# Treść tego serwisu tworzą ludzie. Zgadzamy się na indeksowanie');
  linie.push('# w wyszukiwarkach — z nich przychodzą czytelnicy. NIE zgadzamy');
  linie.push('# się na wykorzystanie tej treści do trenowania modeli AI.');
  linie.push('#');
  linie.push('# Sygnały treści (Content Signals) wyrażają to maszynowo:');
  linie.push('#   search=yes    budowanie indeksu wyszukiwarki — TAK');
  linie.push('#   ai-train=no   trenowanie i dostrajanie modeli — NIE');
  linie.push('#   use=reference wolno cytować ze wskazaniem źródła');
  linie.push('#');
  linie.push('# POWYŻSZE OGRANICZENIA STANOWIĄ WYRAŹNE ZASTRZEŻENIE PRAW');
  linie.push('# W ROZUMIENIU ART. 4 DYREKTYWY (UE) 2019/790 W SPRAWIE PRAWA');
  linie.push('# AUTORSKIEGO NA JEDNOLITYM RYNKU CYFROWYM.');
  linie.push('# ─────────────────────────────────────────────────────────────');
  linie.push('');

  linie.push('User-agent: *');
  linie.push('Content-Signal: search=yes,ai-train=no,use=reference');
  linie.push('Allow: /');
  for (const s of POZA_INDEKSEM) linie.push(`Disallow: ${s}`);
  linie.push('');

  /* Każdy robot w osobnym bloku, nie kilka nagłówków nad jedną regułą.
     Zbiorczy zapis bywa różnie rozumiany przez różne implementacje;
     osobny blok czyta każda z nich tak samo. */
  for (const robot of ROBOTY_AI) {
    linie.push(`User-agent: ${robot}`);
    linie.push('Content-Signal: ai-train=no');
    linie.push('Disallow: /');
    linie.push('');
  }

  linie.push(`Sitemap: ${DOMENA}/sitemap.xml`);
  linie.push('');

  return new Response(linie.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      /* Godzina, nie rok: gdy dojdzie kolejny robot, chcemy, żeby zmiana
         rozeszła się po pośrednikach tego samego dnia. */
      'cache-control': 'public, max-age=3600',
    },
  });
}
