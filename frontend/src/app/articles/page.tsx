import type { Metadata } from 'next';
import { KnowledgeListPage } from '@/components/content/knowledge-list-page';

export const metadata: Metadata = {
  title: 'Artykuły — UNDERNET.ONE',
  description: 'Artykuły techniczne dla administratorów, programistów i power userów.',
  alternates: { canonical: 'https://undernet.one/articles' },
  openGraph: {
    title: 'Artykuły — UNDERNET.ONE',
    description: 'Artykuły techniczne dla administratorów, programistów i power userów.',
    url: 'https://undernet.one/articles',
    type: 'website',
  },
};

/* Lista odświeża się co pięć minut. Materiały nie zmieniają się częściej,
   a każde wejście renderowane na żywo to zapytanie do bazy za nic. */
export const revalidate = 300;

export default function Page() {
  return (
    <KnowledgeListPage
      type="ARTICLE"
      title="Artykuły"
      description="Pełne materiały redakcyjne."
    />
  );
}
