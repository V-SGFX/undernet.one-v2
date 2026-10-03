import { apiOrigin } from '@/lib/api-url';
import type { Metadata } from 'next';

/*
 * Adres backendu do pobrania metadanych.
 *
 * Wcześniej stała czytała `API_INTERNAL_URL` (nazwa, której nikt nie
 * ustawia) i cofała się do portu 4000 — czyli do backendu xdtv, pozostałości
 * po skopiowaniu szkieletu. Każde pobranie kończyło się tam błędem 404,
 * wpadało w `catch` i strona dostawała zapasowy tytuł. Skutek: wszystkie
 * wątki miały w wyszukiwarce ten sam tytuł „Post".
 *
 * `apiOrigin()` po stronie serwera zwraca wewnętrzny adres undernetu i jest
 * jedynym miejscem, w którym ten adres jest zdefiniowany.
 */
const INTERNAL_API = apiOrigin();
/*
 * Adres publiczny — do obrazków w metadanych i do adresu kanonicznego.
 *
 * NIE `apiOrigin()`: po stronie serwera zwraca ono adres wewnętrzny, więc
 * `og:image` wskazywałby `127.0.0.1`, czyli nic — dla każdego robota
 * i każdego serwisu społecznościowego.
 */
const PUBLIC_URL = 'https://undernet.one';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${INTERNAL_API}/api/posts/${id}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { title: 'Post' };
    const post = await res.json();
    // Treść wątku bywa zapisana z prostym HTML — do opisu wchodzi czysty
    // tekst, bo znaczniki w metadanych wyglądają jak śmieci.
    const desc = (post.content ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
    const canonical = `${PUBLIC_URL}/posts/${post.id}`;
    return {
      title: post.title,
      description: desc,
      alternates: { canonical },
      openGraph: {
        title: post.title,
        description: desc,
        url: canonical,
        type: 'article',
        ...(post.imageUrl && {
          images: [{ url: post.imageUrl.startsWith('/') ? `${PUBLIC_URL}${post.imageUrl}` : post.imageUrl }],
        }),
      },
    };
  } catch {
    return { title: 'Post' };
  }
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
