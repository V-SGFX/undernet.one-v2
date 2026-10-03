import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ContentSummary, ContentType } from './knowledge';

export type ContentStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface StudioStats {
  drafts: number;
  review: number;
  publishedToday: number;
  news: number;
  articles: number;
  howto: number;
  wiki: number;
}

export interface StudioItem extends ContentSummary {
  status: ContentStatus;
}

export function useStudioStats() {
  return useQuery({
    queryKey: ['studio', 'stats'],
    queryFn: async (): Promise<StudioStats> => {
      const { data } = await api.get('/content/studio/stats');
      return data;
    },
    staleTime: 30_000,
  });
}

export interface ActivityEntry {
  id: number;
  fromStatus: ContentStatus;
  toStatus: ContentStatus;
  note: string | null;
  createdAt: string;
  reviewer: { id: number; username: string; displayName: string | null } | null;
  contentItem: { id: number; type: ContentType; slug: string; title: string };
}

export function useStudioActivity(limit = 10) {
  return useQuery({
    queryKey: ['studio', 'activity', limit],
    queryFn: async (): Promise<ActivityEntry[]> => {
      const { data } = await api.get(`/content/studio/activity?limit=${limit}`);
      return data;
    },
    staleTime: 30_000,
  });
}

interface StudioListParams {
  type?: ContentType;
  status?: ContentStatus;
  category?: string;
  author?: string;
  q?: string;
  page?: number;
}

export function useStudioList(params: StudioListParams) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
  return useQuery({
    queryKey: ['studio', 'list', params],
    queryFn: async (): Promise<{ data: StudioItem[]; meta: { page: number; pages: number; total: number } }> => {
      const { data } = await api.get(`/content/studio/list?${qs.toString()}`);
      return data;
    },
    staleTime: 15_000,
  });
}

/**
 * Zmiana etapu w obiegu redakcyjnym.
 *
 * Jedna mutacja na wszystkie przejścia — różnią się wyłącznie końcówką
 * adresu, a każda unieważnia dokładnie te same zapytania.
 */
export function useTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, note }: {
      id: number;
      action: 'submit' | 'reject' | 'publish' | 'unpublish' | 'archive';
      note?: string;
    }) => {
      const { data } = await api.patch(`/content/${id}/${action}`, note ? { note } : {});
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studio'] });
      qc.invalidateQueries({ queryKey: ['content'] });
    },
  });
}
