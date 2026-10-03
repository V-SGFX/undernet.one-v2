import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Plan {
  okres: 'month' | 'year';
  priceId: string;
  kwota: number;
  waluta: string;
}

/** Cennik ze Stripe'a. Jawny — strona z cenami działa przed zalogowaniem. */
export function useCennik() {
  return useQuery({
    queryKey: ['stripe', 'cennik'],
    queryFn: async (): Promise<{ wlaczone: boolean; plany: Plan[] }> =>
      (await api.get('/stripe/cennik')).data,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useStanPro(enabled: boolean) {
  return useQuery({
    queryKey: ['stripe', 'moj-stan'],
    queryFn: async (): Promise<{
      isPro: boolean;
      proUntil: string | null;
      status: string | null;
      maPlatnosci: boolean;
    }> => (await api.get('/stripe/moj-stan')).data,
    enabled,
    // Krótko, bo po powrocie z płatności czekamy, aż webhook dojdzie.
    staleTime: 5_000,
    retry: false,
  });
}

export function useStripeAkcje() {
  return {
    kup: useMutation({
      mutationFn: async (okres: 'month' | 'year') =>
        (await api.post('/stripe/sesja', { okres })).data as { url: string },
    }),
    panel: useMutation({
      mutationFn: async () => (await api.post('/stripe/panel')).data as { url: string },
    }),
  };
}
