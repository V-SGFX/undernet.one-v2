import type { Metadata } from 'next';
import { KnowledgeForm } from '@/components/content/knowledge-form';
import { TYPE_BY_PATH, type ContentType } from '@/lib/queries/knowledge';

export const metadata: Metadata = {
  title: 'Nowy materiał — Undernet Studio',
  robots: { index: false, follow: false },
};

/**
 * Dwa parametry, oba wypełniane przez przyciski, nie przez człowieka:
 *
 *  • `typ=news|articles|how-to|wiki` — rodzaj materiału z góry. Skrót
 *    „Napisz news" prowadzi prosto do pustego newsa.
 *  • `zrodlo=7` — wątek, z którego materiał wyrasta. Wypełnia go przycisk
 *    „Zaproponuj materiał" pod samą dyskusją, więc numeru nie trzeba
 *    nigdzie przepisywać z pamięci.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ typ?: string; zrodlo?: string }>;
}) {
  const { typ, zrodlo } = await searchParams;
  const initialType = typ ? (TYPE_BY_PATH[typ] as ContentType | undefined) : undefined;

  const parsed = Number(zrodlo);
  const initialSourcePostId = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;

  return <KnowledgeForm initialType={initialType} initialSourcePostId={initialSourcePostId} />;
}
