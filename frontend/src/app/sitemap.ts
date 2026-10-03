import { apiOrigin } from '@/lib/api-url';
import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://undernet.one';
const API = apiOrigin();

/** Adres publiczny każdego typu materiału. */
const PATHS = { NEWS: 'news', ARTICLE: 'articles', HOWTO: 'how-to', WIKI: 'wiki' } as const;

interface Row { type: keyof typeof PATHS; slug: string; updatedAt: string; publishedAt: string | null }
interface Watek { id: number; updatedAt: string; isDeleted?: boolean }
interface Spolecznosc { slug: string; postCount: number }

/**
 * Mapa witryny.
 *
 * Pobiera materiały stronami, a nie jednym zapytaniem bez limitu: API
 * ogranicza stronę do 50 wpisów, więc „daj wszystko" i tak zwróciłoby
 * pięćdziesiąt, a mapa po cichu gubiłaby resztę.
 *
 * Awaria API nie może wywrócić mapy — lepiej oddać same strony stałe niż
 * błąd 500, po którym wyszukiwarka przestaje o nią pytać.
 */
async function fetchAll(): Promise<Row[]> {
  const out: Row[] = [];
  try {
    for (let page = 1; page <= 40; page++) {
      const res = await fetch(`${API}/api/content?page=${page}&limit=50`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const json = await res.json();
      out.push(...(json.data ?? []));
      if (page >= (json.meta?.pages ?? 1)) break;
    }
  } catch {
    // Mapa stron stałych i tak zostanie oddana.
  }
  return out;
}

/**
 * Wątki forum.
 *
 * Wcześniej nie było ich w mapie w ogóle — a to największa część serwisu
 * pod względem liczby adresów.
 */
async function fetchWatki(): Promise<Watek[]> {
  const out: Watek[] = [];
  try {
    for (let page = 1; page <= 60; page++) {
      const res = await fetch(`${API}/api/posts?page=${page}&limit=50`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const json = await res.json();
      out.push(...(json.data ?? []));
      if (page >= (json.meta?.pages ?? 1)) break;
    }
  } catch {
    // Brak wątków nie może wywrócić całej mapy.
  }
  return out.filter((w) => !w.isDeleted);
}

/**
 * Społeczności — WYŁĄCZNIE te, w których coś jest.
 *
 * Pusta kategoria w mapie witryny to zaproszenie dla wyszukiwarki do
 * zaindeksowania strony bez treści. Przy rozbudowanej strukturze działów
 * takich stron byłoby kilkadziesiąt i wszystkie wyglądałyby identycznie —
 * a to jest dokładnie definicja treści bezwartościowej.
 */
async function fetchSpolecznosci(): Promise<Spolecznosc[]> {
  try {
    const res = await fetch(`${API}/api/communities`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    const lista: Spolecznosc[] = Array.isArray(json) ? json : (json.data ?? []);
    return lista.filter((c) => (c.postCount ?? 0) > 0);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const stat: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/community`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/wiki`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/how-to`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/articles`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/news`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE}/discover`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
  ];

  const [items, watki, spolecznosci] = await Promise.all([
    fetchAll(),
    fetchWatki(),
    fetchSpolecznosci(),
  ]);
  const dynamic: MetadataRoute.Sitemap = items.map((i) => ({
    url: `${BASE}/${PATHS[i.type]}/${i.slug}`,
    lastModified: new Date(i.updatedAt),
    // Wiki jest aktualizowane, reszta raczej nie — to informacja dla
    // wyszukiwarki, jak często wracać.
    changeFrequency: i.type === 'WIKI' ? ('weekly' as const) : ('monthly' as const),
    priority: i.type === 'WIKI' || i.type === 'HOWTO' ? 0.8 : 0.6,
  }));

  const watkiMap: MetadataRoute.Sitemap = watki.map((w) => ({
    url: `${BASE}/posts/${w.id}`,
    lastModified: new Date(w.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const spolecznosciMap: MetadataRoute.Sitemap = spolecznosci.map((c) => ({
    url: `${BASE}/community/${c.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  return [...stat, ...dynamic, ...spolecznosciMap, ...watkiMap];
}
