import { queryOptions, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Typy materiałów bazy wiedzy. Muszą zgadzać się z enumem w bazie. */
export type ContentType = 'NEWS' | 'ARTICLE' | 'HOWTO' | 'WIKI';

/** Adres publiczny ↔ typ. Jedno miejsce, w którym te dwa światy się spotykają. */
export const PATH_BY_TYPE: Record<ContentType, string> = {
  NEWS: 'news',
  ARTICLE: 'articles',
  HOWTO: 'how-to',
  WIKI: 'wiki',
};

export const TYPE_BY_PATH: Record<string, ContentType> = Object.fromEntries(
  Object.entries(PATH_BY_TYPE).map(([t, p]) => [p, t as ContentType]),
) as Record<string, ContentType>;

export interface ContentSummary {
  id: number;
  type: ContentType;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  readingTime: number | null;
  viewCount: number;
  commentCount: number;
  publishedAt: string | null;
  updatedAt: string;
  author: { id: number; slug: string; name: string; avatarUrl: string | null } | null;
  category: { id: number; slug: string; name: string } | null;
  tags: { id: number; slug: string; name: string }[];
}

export interface ContentPage {
  data: ContentSummary[];
  meta: { page: number; limit: number; total: number; pages: number };
}

interface ListParams {
  type?: ContentType;
  category?: string;
  author?: string;
  tag?: string;
  q?: string;
  sort?: 'new' | 'popular';
  page?: number;
  limit?: number;
}

function toQuery(p: ListParams) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') q.set(k, String(v));
  return q.toString();
}

/**
 * Lista materiałów. Jedno zapytanie obsługuje wszystkie cztery typy.
 *
 * Wystawione jako `queryOptions`, a nie tylko jako hak, żeby serwer mógł
 * pobrać dokładnie to samo pod dokładnie tym samym kluczem. Wcześniej
 * zapytanie żyło wyłącznie w przeglądarce: serwer odsyłał pustą ramkę,
 * a treść pojawiała się dopiero po pobraniu JS-a i dwóch dodatkowych
 * przejściach po sieci — stąd wrażenie, że /wiki, /how-to i /news
 * ładują się wolno, mimo że API odpowiada w ok. 130 ms.
 */
export function contentListQuery(params: ListParams) {
  return queryOptions({
    queryKey: ['content', 'list', params],
    queryFn: async (): Promise<ContentPage> => {
      const { data } = await api.get(`/content?${toQuery(params)}`);
      return data;
    },
    staleTime: 60_000,
  });
}

export function useContentList(params: ListParams) {
  return useQuery(contentListQuery(params));
}

/** Materiały powstałe z wątku — baner „na podstawie tej dyskusji". */
export function useDerivedContent(postId: number | null) {
  return useQuery({
    queryKey: ['content', 'derived', postId],
    queryFn: async (): Promise<ContentSummary[]> => {
      const { data } = await api.get(`/content/derived/${postId}`);
      return data;
    },
    enabled: Boolean(postId),
    staleTime: 5 * 60_000,
  });
}

export interface CategoryNode {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  _count: { items: number };
  children: CategoryNode[];
}

/**
 * Drzewo kategorii z licznikiem materiałów.
 *
 * `type` zawęża licznik do jednego rodzaju — ten sam filtr, którego użyje
 * lista pod spodem. Bez niego na zakładce „How To" przy kategorii stała
 * liczba obejmująca wiki i artykuły, więc „Sieć 3" nie zgadzało się
 * z jedną widoczną instrukcją.
 */
export function categoriesQuery(type?: ContentType) {
  return queryOptions({
    queryKey: ['content', 'categories', type ?? 'all'],
    queryFn: async (): Promise<CategoryNode[]> => {
      const { data } = await api.get(`/content-categories${type ? `?type=${type}` : ''}`);
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

export function useCategories(type?: ContentType) {
  return useQuery(categoriesQuery(type));
}
