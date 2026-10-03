import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Szukaj',
  description: 'Szukaj wątków, materiałów, użytkowników i społeczności na UNDERNET.ONE.',
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
