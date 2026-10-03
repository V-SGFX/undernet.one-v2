import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rejestracja',
  description: 'Dołącz do UNDERNET.ONE — załóż konto za darmo.',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
