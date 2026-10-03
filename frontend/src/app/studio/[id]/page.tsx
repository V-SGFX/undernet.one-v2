import type { Metadata } from 'next';
import { KnowledgeForm } from '@/components/content/knowledge-form';

export const metadata: Metadata = {
  title: 'Edycja materiału — Undernet Studio',
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KnowledgeForm id={Number(id)} />;
}
