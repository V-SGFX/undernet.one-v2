import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Notatka {
  id: number;
  body: string;
  postId: number | null;
  contentItemId: number | null;
  updatedAt: string;
  post?: { id: number; title: string } | null;
  contentItem?: { id: number; type: string; slug: string; title: string } | null;
}

const cel = (t: { postId?: number; contentItemId?: number }) =>
  t.postId ? `postId=${t.postId}` : `contentItemId=${t.contentItemId}`;

/** Notatka do jednej rzeczy — `null`, gdy jeszcze nie istnieje. */
export function useNote(t: { postId?: number; contentItemId?: number }, enabled = true) {
  return useQuery({
    queryKey: ['notes', 'do', cel(t)],
    queryFn: async (): Promise<Notatka | null> => {
      const { data } = await api.get(`/notes/do?${cel(t)}`);
      return data ?? null;
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/** Wszystkie notatki — widok w profilu. */
export function useNotes(enabled = true) {
  return useQuery({
    queryKey: ['notes'],
    queryFn: async (): Promise<Notatka[]> => (await api.get('/notes')).data,
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

export function useNoteMutations() {
  const qc = useQueryClient();
  const odswiez = () => qc.invalidateQueries({ queryKey: ['notes'] });

  return {
    zapisz: useMutation({
      mutationFn: async (v: { postId?: number; contentItemId?: number; body: string }) =>
        (await api.post('/notes', v)).data,
      onSuccess: odswiez,
    }),
    usun: useMutation({
      mutationFn: async (id: number) => (await api.delete(`/notes/${id}`)).data,
      onSuccess: odswiez,
    }),
  };
}
