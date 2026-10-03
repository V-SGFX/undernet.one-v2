import type { Metadata } from 'next';
import { KnowledgeListPage } from '@/components/content/knowledge-list-page';

export const metadata: Metadata = {
  title: 'Wiki — UNDERNET.ONE',
  description: 'Baza wiedzy UNDERNET.ONE: pojęcia, protokoły, narzędzia.',
  alternates: { canonical: 'https://undernet.one/wiki' },
  openGraph: {
    title: 'Wiki — UNDERNET.ONE',
    description: 'Baza wiedzy UNDERNET.ONE: pojęcia, protokoły, narzędzia.',
    url: 'https://undernet.one/wiki',
    type: 'website',
  },
};

/* Lista odświeża się co pięć minut. Materiały nie zmieniają się częściej,
   a każde wejście renderowane na żywo to zapytanie do bazy za nic. */
export const revalidate = 300;

export default function Page() {
  return (
    <KnowledgeListPage
      type="WIKI"
      title="Wiki"
      description="Baza wiedzy — hasła, które żyją i są aktualizowane."
    />
  );
}
