'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Separator między logowaniem kontem zewnętrznym a formularzem.
 *
 * Pyta o tych samych dostawców co przyciski i znika razem z nimi. Wcześniej
 * kreska z napisem „albo" stała na stałe, więc gdy przyciski nie miały co
 * pokazać, strona zaczynała się od poziomej linii donikąd.
 */
export function AuthDivider({ label = 'albo' }: { label?: string }) {
  const { data } = useQuery({
    queryKey: ['oauth', 'providers'],
    queryFn: async (): Promise<{ provider: string; configured: boolean }[]> => {
      const { data } = await api.get('/oauth/providers');
      return data;
    },
    staleTime: 10 * 60_000,
  });

  if (!data?.some((p) => p.configured)) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border-default" />
      <span className="text-xs uppercase text-text-dimmed">{label}</span>
      <div className="h-px flex-1 bg-border-default" />
    </div>
  );
}
