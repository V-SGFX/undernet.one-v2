import { apiOrigin } from '@/lib/api-url';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { KnowledgeDetail, type ContentDetail } from '@/components/content/knowledge-detail';
import type { ContentSummary } from '@/lib/queries/knowledge';

const API = apiOrigin();
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://undernet.one';

interface Props { params: Promise<{ slug: string }> }

/* Pobranie na serwerze, nie w przeglądarce: materiał ma być w HTML-u,
   który dostaje wyszukiwarka. Klientowy fetch dałby pustą stronę
   dla wszystkiego, co nie wykonuje JavaScriptu. */
/**
 * Gdzie ten materiał mieszka teraz.
 *
 * Rodzaj materiału bywa zmieniany po publikacji, a wtedy adres przenosi
 * się z `/wiki/x` na `/how-to/x`. Bez tego zapytania stary odnośnik —
 * z czyjejś zakładki, z wyszukiwarki, z listy, która akurat wisi w innej
 * karcie — kończył się stroną „nie znaleziono".
 */
async function resolveSlug(slug: string): Promise<{ type: string; slug: string } | null> {
  const res = await fetch(`${API}/api/content/resolve/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60, tags: ['content'] },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

const SCIEZKA_TYPU: Record<string, string> = {
  NEWS: 'news', ARTICLE: 'articles', HOWTO: 'how-to', WIKI: 'wiki',
};

async function fetchItem(slug: string): Promise<ContentDetail | null> {
  const res = await fetch(`${API}/api/content/wiki/${encodeURIComponent(slug)}`, {
    /*
     * Znacznik, nie sam czas życia.
     *
     * `revalidatePath` czyści pamięć STRON, ale nie pamięć ZAPYTAŃ —
     * ta odpowiedź żyła własne 300 sekund. Po zmianie rodzaju materiału
     * regeneracja strony sięgała po starą, wciąż zapisaną odpowiedź
     * i odtwarzała nieaktualną stronę pod poprzednim adresem.
     * Backend unieważnia teraz po znaczniku i znika jedno i drugie.
     */
    next: { revalidate: 300, tags: ['content', `content:${slug}`] },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchRelated(id: number): Promise<ContentSummary[]> {
  const res = await fetch(`${API}/api/content/${id}/related`, { next: { revalidate: 600, tags: ['content'] } });
  return res.ok ? res.json() : [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchItem(slug);
  if (!item) return { title: 'Nie znaleziono' };

  const title = item.metaTitle || item.title;
  const description = item.metaDescription || item.excerpt || undefined;
  const url = item.canonicalUrl || `${SITE}/wiki/${item.slug}`;
  const image = item.ogImage || item.coverUrl || undefined;

  return {
    /*
     * Nazwa serwisu doklejana RAZ.
     *
     * Układ główny ma szablon `%s | UNDERNET.ONE`, a strona dokładała jeszcze
     * „— UNDERNET.ONE" od siebie: w wyniku wyszukiwania stało „Tytuł —
     * UNDERNET.ONE | UNDERNET.ONE", co zjadało miejsce na właściwy tytuł.
     */
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: item.ogTitle || title,
      description: item.ogDescription || description,
      url,
      type: 'article',
      publishedTime: item.publishedAt ?? undefined,
      modifiedTime: item.updatedAt,
      ...(image && { images: [image] }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: item.ogTitle || title,
      description: item.ogDescription || description,
      ...(image && { images: [image] }),
    },
  };
}

export const revalidate = 300;

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const item = await fetchItem(slug);
  if (!item) {
    // Zanim pokażemy „nie znaleziono": może materiał zmienił rodzaj
    // i mieszka teraz pod innym adresem.
    const gdzie = await resolveSlug(slug);
    const docelowa = gdzie ? SCIEZKA_TYPU[gdzie.type] : null;
    if (docelowa && docelowa !== 'wiki') redirect(`/${docelowa}/${gdzie!.slug}`);
    notFound();
  }

  const related = await fetchRelated(item.id);

  /* Dane strukturalne. Typ Article dobrany do rodzaju materiału —
     wyszukiwarka pokazuje poradnik inaczej niż aktualność. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: item.title,
    description: item.metaDescription || item.excerpt || undefined,
    datePublished: item.publishedAt ?? undefined,
    dateModified: item.updatedAt,
    ...(item.author && { author: { '@type': 'Person', name: item.author.name } }),
    ...(item.coverUrl && { image: item.coverUrl }),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': item.canonicalUrl || `${SITE}/wiki/${item.slug}`,
    },
    publisher: { '@type': 'Organization', name: 'UNDERNET.ONE' },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <KnowledgeDetail item={item} related={related} />
    </>
  );
}
