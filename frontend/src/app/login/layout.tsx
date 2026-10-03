import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Logowanie',
  description: 'Zaloguj się do UNDERNET.ONE.',
  robots: { index: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
