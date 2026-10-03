import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type ZakresAlertu = 'POSTS' | 'CONTENT' | 'BOTH';

export interface Alert {
  id: number;
  phrase: string;
  scope: ZakresAlertu;
  isActive: boolean;
  hitCount: number;
  createdAt: string;
}

export function useAlerts(enabled = true) {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async (): Promise<Alert[]> => (await api.get('/alerts')).data,
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

export function useAlertMutations() {
  const qc = useQueryClient();
  const odswiez = () => qc.invalidateQueries({ queryKey: ['alerts'] });

  return {
    utworz: useMutation({
      mutationFn: async (v: { phrase: string; scope: ZakresAlertu }) =>
        (await api.post('/alerts', v)).data,
      onSuccess: odswiez,
    }),
    przelacz: useMutation({
      mutationFn: async (id: number) => (await api.patch(`/alerts/${id}/przelacz`)).data,
      onSuccess: odswiez,
    }),
    usun: useMutation({
      mutationFn: async (id: number) => (await api.delete(`/alerts/${id}`)).data,
      onSuccess: odswiez,
    }),
  };
}
