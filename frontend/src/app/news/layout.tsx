import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Newsy ze Świata Streamingu',
  description: 'Newsy techniczne pisane przez redakcję UNDERNET.ONE: wydania, luki, zmiany w narzędziach.',
  alternates: { canonical: 'https://undernet.one/news' },
  openGraph: {
    title: 'Newsy — UNDERNET.ONE',
    description: 'Najnowsze wiadomości ze świata streamingu.',
    url: 'https://undernet.one/news',
  },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
