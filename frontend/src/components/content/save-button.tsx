'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * Save an individual piece of content — a clip, a post, an entry.
 *
 * Ta sama krawędź „obserwowane" co obserwowanie społeczności czy tagu, więc pisze
 * to the same table; the difference is only what it points at. Rendered as a
 * bookmark on the tile rather than a labelled button, because a card already
 * carries a title, an author, a game and a metric and does not need a fifth
 * piece of text.
 *
 * Saved state is hydrated for the whole page at once by the wall, so this
 * normally reads from cache and issues no request of its own.
 */
export function SaveButton({
  postId,
  className = '',
  withLabel = false,
}: {
  postId: number;
  className?: string;
  /**
   * Podpis obok ikony.
   *
   * Na kafelku zbędny — kafelek niesie już tytuł, autora i licznik,
   * a piąty tekst tylko go zaciemnia. W otwartym wątku odwrotnie:
   * sąsiednie akcje („Udostępnij", „Zgłoś") mają podpisy, więc sama
   * ikona wyglądałaby na coś zapomnianego.
   */
  withLabel?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['undernet', 'follow', 'post', postId] as const;

  const { data: saved = false } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get(`/follows/post/check/${postId}`);
      return Boolean(data?.following);
    },
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });

  const toggle = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/follows/post/${postId}`);
      return Boolean(data?.following);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData(key, !prev);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['undernet', 'saved-posts'] });
    },
  });

  if (!user) return null;

  const opis = saved ? 'Usuń z zapisanych' : 'Zapisz';

  const wspolne = {
    type: 'button' as const,
    // Kafelek jest jednym wielkim odnośnikiem — bez tego klik nawigowałby.
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggle.mutate();
    },
    'aria-pressed': saved,
    title: opis,
  };

  if (withLabel) {
    return (
      <button
        {...wspolne}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
          saved
            ? 'bg-accent/10 text-accent'
            : 'text-text-muted hover:bg-dark-700 hover:text-text-primary'
        } ${className}`}
      >
        <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
        <span className="text-xs">{saved ? 'Zapisane' : 'Zapisz'}</span>
      </button>
    );
  }

  return (
    <button
      {...wspolne}
      aria-label={opis}
      className={`grid h-8 w-8 place-items-center rounded-sm backdrop-blur-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        saved
          ? 'bg-accent/90 text-black'
          : 'bg-black/55 text-white/80 hover:bg-black/75 hover:text-white'
      } ${className}`}
    >
      <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
    </button>
  );
}
