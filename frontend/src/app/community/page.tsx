import { apiOrigin } from '@/lib/api-url';
import type { Metadata } from 'next';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { feedQuery } from '@/lib/queries/feed-query';
import CommunityFeedPage from './community-feed-client';

const BASE_URL = 'https://undernet.one';
const API_URL = apiOrigin();

type CommunityMeta = {
  name?: string;
  slug?: string;
  description?: string | null;
  postCount?: number;
};

function toSlug(raw: string): string {
  return decodeURIComponent(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

async function resolveCommunity(input?: string): Promise<CommunityMeta | null> {
  if (!input) return null;
  const candidate = toSlug(input);
  if (!candidate) return null;

  try {
    const bySlug = await fetch(`${API_URL}/api/communities/${encodeURIComponent(candidate)}`, {
      next: { revalidate: 300 },
    });
    if (bySlug.ok) {
      return await bySlug.json();
    }
  } catch {}

  try {
    const listRes = await fetch(`${API_URL}/api/communities`, { next: { revalidate: 300 } });
    if (!listRes.ok) return null;
    const list = await listRes.json();
    const found = Array.isArray(list)
      ? list.find((c: CommunityMeta) => toSlug(c.slug || '') === candidate || toSlug(c.name || '') === candidate)
      : null;

    if (!found?.slug) return null;

    const fullRes = await fetch(`${API_URL}/api/communities/${encodeURIComponent(found.slug)}`, {
      next: { revalidate: 300 },
    });
    if (!fullRes.ok) return found;
    return await fullRes.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ community?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const communityParam = sp?.community;
  const community = await resolveCommunity(communityParam);

  if (!community?.slug || !community?.name) {
    return {
      title: 'Społeczności — dyskusje techniczne',
      description:
        'Dołącz do społeczności UNDERNET.ONE: opisz problem, podziel się rozwiązaniem, śledź wątki ze swojej działki.',
      alternates: {
        canonical: `${BASE_URL}/community`,
      },
      openGraph: {
        title: 'Społeczności — dyskusje techniczne',
        description:
          'Linux, sieci, kod, sprzęt i bezpieczeństwo — po jednej społeczności na każdą działkę.',
        url: `${BASE_URL}/community`,
      },
    };
  }

  // Kanoniczny jest adres ze ścieżką — patrz /community/[slug]/page.tsx.
  // Ten widok z parametrem zostaje działający, ale wskazuje tamten.
  const canonical = `${BASE_URL}/community/${encodeURIComponent(community.slug)}`;
  const postCount = Number.isFinite(community.postCount) ? community.postCount : 0;
  const baseDescription =
    community.description?.trim() ||
    `Społeczność c/${community.name} na UNDERNET.ONE: pytania, rozwiązania i bieżące wątki.`;

  return {
    title: `c/${community.name} — ${postCount} dyskusji w społeczności`,
    description: `${baseDescription} Zobacz, nad czym pracuje c/${community.name}.`,
    keywords: [
      `c/${community.name}`,
      `${community.name} społeczność`,
      `${community.name} forum`,
      'pomoc techniczna',
      'undernet community',
    ],
    alternates: {
      canonical,
    },
    openGraph: {
      title: `c/${community.name} — społeczność`,
      description: `${baseDescription} Wejdź i dołącz do rozmowy.`,
      url: canonical,
      images: ['/opengraph-image'],
    },
  };
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ community?: string }>;
}) {
  const sp = await searchParams;
  const queryClient = getQueryClient();

  // Community is a content surface, so it ships with content rather than a
  // grid of skeletons.
  await queryClient
    .prefetchInfiniteQuery(feedQuery({ community: sp?.community || undefined }))
    .catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommunityFeedPage />
    </HydrationBoundary>
  );
}
