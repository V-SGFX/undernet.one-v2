import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Kolekcja {
  id: number;
  name: string;
  description: string | null;
  position: number;
  _count?: { items: number };
}

export function useCollections(enabled = true) {
  return useQuery({
    queryKey: ['collections'],
    queryFn: async (): Promise<Kolekcja[]> => {
      const { data } = await api.get('/collections');
      return data;
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useCollection(id: number | null) {
  return useQuery({
    queryKey: ['collections', id],
    queryFn: async () => {
      const { data } = await api.get(`/collections/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

/**
 * W których kolekcjach leży dana rzecz.
 *
 * Pytamy o to przy otwarciu listy, żeby od razu pokazać zaznaczone —
 * zamiast kazać użytkownikowi pamiętać, gdzie już to wrzucił.
 */
export function useWhereIs(target: { postId?: number; contentItemId?: number }, enabled = true) {
  const qs = target.postId ? `postId=${target.postId}` : `contentItemId=${target.contentItemId}`;
  return useQuery({
    queryKey: ['collections', 'gdzie-jest', qs],
    queryFn: async (): Promise<number[]> => {
      const { data } = await api.get(`/collections/gdzie-jest?${qs}`);
      return data;
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

export function useCollectionMutations() {
  const qc = useQueryClient();
  const odswiez = () => {
    qc.invalidateQueries({ queryKey: ['collections'] });
  };

  return {
    utworz: useMutation({
      mutationFn: async (dane: { name: string; description?: string }) =>
        (await api.post('/collections', dane)).data,
      onSuccess: odswiez,
    }),
    usun: useMutation({
      mutationFn: async (id: number) => (await api.delete(`/collections/${id}`)).data,
      onSuccess: odswiez,
    }),
    dodajPozycje: useMutation({
      mutationFn: async (v: { collectionId: number; postId?: number; contentItemId?: number }) =>
        (await api.post(`/collections/${v.collectionId}/items`, {
          postId: v.postId, contentItemId: v.contentItemId,
        })).data,
      onSuccess: odswiez,
    }),
    usunPozycje: useMutation({
      mutationFn: async (v: { collectionId: number; itemId: number }) =>
        (await api.delete(`/collections/${v.collectionId}/items/${v.itemId}`)).data,
      onSuccess: odswiez,
    }),
  };
}
