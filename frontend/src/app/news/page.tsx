import type { Metadata } from 'next';
import { KnowledgeListPage } from '@/components/content/knowledge-list-page';

export const metadata: Metadata = {
  title: 'News — UNDERNET.ONE',
  description: 'Aktualności techniczne — wydania, zmiany, luki i wydarzenia branżowe.',
  alternates: { canonical: 'https://undernet.one/news' },
  openGraph: {
    title: 'News — UNDERNET.ONE',
    description: 'Aktualności techniczne — wydania, zmiany, luki i wydarzenia branżowe.',
    url: 'https://undernet.one/news',
    type: 'website',
  },
};

/* Lista odświeża się co pięć minut. Materiały nie zmieniają się częściej,
   a każde wejście renderowane na żywo to zapytanie do bazy za nic. */
export const revalidate = 300;

export default function Page() {
  return (
    <KnowledgeListPage
      type="NEWS"
      title="News"
      description="Aktualności techniczne: wydania, zmiany, bezpieczeństwo."
    />
  );
}
