'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SocialLoginButtonsProps {
  /** Ustawiony — przycisk dopina konto zamiast logować (tryb ustawień). */
  linkToken?: string;
  label?: 'login' | 'register';
}

type ProviderId = 'discord' | 'google' | 'github';

/**
 * Logowanie kontem zewnętrznym.
 *
 * Twitch i Kick wypadły stąd razem z całą warstwą streamingu — na portalu
 * technicznym to konta, których czytelnik nie ma i mieć nie musi. Discord
 * został, bo społeczność techniczna faktycznie tam siedzi.
 *
 * Przyciski rysujemy dopiero po sprawdzeniu, których dostawców backend ma
 * skonfigurowanych. Wcześniej były tu trzy przyciski wpisane na sztywno,
 * prowadzące do endpointu, którego ten backend w ogóle nie montował —
 * każdy z nich kończył się białą stroną.
 */
const PROVIDERS: Record<ProviderId, {
  name: string;
  className: string;
  icon: React.ReactNode;
}> = {
  discord: {
    name: 'Discord',
    className: 'border-[#5865F2]/30 bg-[#5865F2]/10 text-[#8891f5] hover:bg-[#5865F2]/20',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
  google: {
    name: 'Google',
    className: 'border-border-default bg-surface-raised text-content-primary hover:border-content-muted',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z" />
      </svg>
    ),
  },
  github: {
    name: 'GitHub',
    className: 'border-border-default bg-surface-raised text-content-primary hover:border-content-muted',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.8 1.31 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.13-.3-.54-1.53.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.23 0 4.63-2.8 5.65-5.48 5.95.43.37.82 1.1.82 2.22v3.29c0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
      </svg>
    ),
  },
};

const ORDER: ProviderId[] = ['discord', 'google', 'github'];

export function SocialLoginButtons({ linkToken, label = 'login' }: SocialLoginButtonsProps) {
  const { data } = useQuery({
    queryKey: ['oauth', 'providers'],
    queryFn: async (): Promise<{ provider: ProviderId; configured: boolean }[]> => {
      const { data } = await api.get('/oauth/providers');
      return data;
    },
    staleTime: 10 * 60_000,
  });

  const available = ORDER.filter((id) => data?.find((p) => p.provider === id)?.configured);

  // Nic nie skonfigurowane — nie pokazujemy ani przycisków, ani separatora.
  // Pusty blok z napisem „albo" wygląda jak awaria.
  if (available.length === 0) return null;

  const go = (id: ProviderId) => {
    const qs = new URLSearchParams();
    if (linkToken) {
      qs.set('action', 'link');
      qs.set('token', linkToken);
    }
    const s = qs.toString();
    // Pełne przejście na tę samą domenę — nginx kieruje /api/ do backendu.
    window.location.href = `/api/oauth/${id}${s ? `?${s}` : ''}`;
  };

  const verb = linkToken ? 'Połącz z' : label === 'register' ? 'Zarejestruj przez' : 'Zaloguj przez';

  return (
    <div className="space-y-2">
      {available.map((id) => {
        const p = PROVIDERS[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            className={`flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${p.className}`}
          >
            {p.icon}
            {verb} {p.name}
          </button>
        );
      })}
    </div>
  );
}
