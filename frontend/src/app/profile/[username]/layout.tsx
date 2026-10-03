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
// Publiczny adres, nie wewnętrzny — patrz komentarz w layoucie wątku.
const PUBLIC_URL = 'https://undernet.one';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  try {
    const res = await fetch(`${INTERNAL_API}/api/users/username/${username}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { title: 'Profil' };
    const user = await res.json();
    const name = user.displayName || user.username;
    return {
      title: name,
      description: `Profil ${name} na UNDERNET.ONE — wpisy, komentarze i aktywność.`,
      openGraph: {
        title: `${name} | UNDERNET.ONE`,
        description: `Profil ${name} na UNDERNET.ONE.`,
        url: `https://undernet.one/profile/${username}`,
        type: 'profile',
        ...(user.avatarUrl && {
          images: [{ url: user.avatarUrl.startsWith('/') ? `${PUBLIC_URL}${user.avatarUrl}` : user.avatarUrl }],
        }),
      },
    };
  } catch {
    return { title: 'Profil' };
  }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
