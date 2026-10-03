import type { Metadata } from 'next';
import { KnowledgeListPage } from '@/components/content/knowledge-list-page';

export const metadata: Metadata = {
  title: 'How To — UNDERNET.ONE',
  description: 'Praktyczne poradniki: konfiguracja, wdrożenie, rozwiązywanie problemów.',
  alternates: { canonical: 'https://undernet.one/how-to' },
  openGraph: {
    title: 'How To — UNDERNET.ONE',
    description: 'Praktyczne poradniki: konfiguracja, wdrożenie, rozwiązywanie problemów.',
    url: 'https://undernet.one/how-to',
    type: 'website',
  },
};

/* Lista odświeża się co pięć minut. Materiały nie zmieniają się częściej,
   a każde wejście renderowane na żywo to zapytanie do bazy za nic. */
export const revalidate = 300;

export default function Page() {
  return (
    <KnowledgeListPage
      type="HOWTO"
      title="How To"
      description="Poradniki krok po kroku."
    />
  );
}
