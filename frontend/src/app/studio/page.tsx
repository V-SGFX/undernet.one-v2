import type { Metadata } from 'next';
import { StudioScreen } from './studio-screen';

export const metadata: Metadata = {
  title: 'Undernet Studio',
  // Zaplecze nie jest treścią portalu — wyszukiwarka nie ma tu czego szukać.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <StudioScreen />;
}
