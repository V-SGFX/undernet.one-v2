import type { News, Post, Tag } from '@/lib/types';

/**
 * Ściana renderuje treść z dwóch niezależnych kształtów API: Post (wpisy)
 * i News (materiały). Sprowadzenie ich do jednego typu tutaj pozwala
 * ContentWall zostać komponentem układu, zamiast rozgałęziać się po
 * surowych odpowiedziach.
 *
 * Były tu jeszcze dwa rodzaje — `clip` i `live`. Przyszły ze szkieletu
 * xdtv i opierały się na polach, których backend undernetu już nie zwraca
 * (`streamerProfile`, `clipSource`, statystyki transmisji). Nic ich nie
 * wytwarzało, a układ ściany wciąż podejmował po nich decyzje.
 */

export type ContentKind = 'post' | 'article';

export interface ContentAuthor {
  name: string;
  avatarUrl: string | null;
  href: string | null;
}

interface ContentBase {
  kind: ContentKind;
  /** Unique across kinds — ids collide between Post and News otherwise. */
  key: string;
  href: string;
  title: string;
  createdAt: string | null;
}

export interface PostContent extends ContentBase {
  kind: 'post';
  postId: number;
  body: string;
  imageUrl: string | null;
  imageCount: number;
  score: number;
  commentCount: number;
  author: ContentAuthor | null;
  community: { name: string; slug: string; color: string | null } | null;
  game: Tag | null;
  isNsfw: boolean;
  hasPoll: boolean;
}

export interface ArticleContent extends ContentBase {
  kind: 'article';
  imageUrl: string | null;
  summary: string | null;
  sourceName: string | null;
  sourceUrl: string;
}

export type ContentItem = PostContent | ArticleContent;

// ─── tag helpers ────────────────────────────────────────────────────────────

/**
 * Tagi przychodzą albo spłaszczone (kanał), albo jako wiersze złączenia
 * PostTag (widok wpisu). Tagi typu FORMAT nic na kafelku nie wnoszą,
 * więc nic ich stąd nie wydobywa.
 */
type MaybeJoined = Tag | { tag: Tag };

function flattenTags(tags: MaybeJoined[] | undefined): Tag[] {
  if (!tags?.length) return [];
  return tags.map((t) => ('tag' in t ? t.tag : t)).filter(Boolean);
}

function pickTag(tags: Tag[], type: string): Tag | null {
  return tags.find((t) => (t as Tag & { type?: string }).type === type) ?? null;
}

// ─── adapters ───────────────────────────────────────────────────────────────

export function toPostContent(post: Post): PostContent {
  const tags = flattenTags(post.tags as MaybeJoined[] | undefined);
  const images = post.images ?? [];
  const firstImage = images[0]?.url ?? post.imageUrl ?? null;

  return {
    kind: 'post',
    key: `post-${post.id}`,
    postId: post.id,
    href: `/posts/${post.id}`,
    title: post.title,
    createdAt: post.createdAt,
    body: post.content ?? '',
    imageUrl: firstImage,
    imageCount: images.length || (post.imageUrl ? 1 : 0),
    score: (post.upvotes ?? 0) - (post.downvotes ?? 0),
    commentCount: post.commentCount ?? 0,
    author: post.author
      ? {
          name: post.author.displayName || post.author.username,
          avatarUrl: post.author.avatarUrl,
          href: `/profile/${post.author.username}`,
        }
      : null,
    community: post.community
      ? { name: post.community.name, slug: post.community.slug, color: post.community.color ?? null }
      : null,
    game: pickTag(tags, 'GAME'),
    isNsfw: Boolean(post.isNsfw),
    hasPoll: Boolean(post.poll),
  };
}

/** Wpis → kafelek. Jeden rodzaj, bo wpis jest tu jedynym formatem. */
export function toContentItem(post: Post): PostContent {
  return toPostContent(post);
}

export function toArticleContent(news: News): ArticleContent {
  return {
    kind: 'article',
    key: `article-${news.id}`,
    // Our own page, not the publisher's. An article used to link straight
    // out, so a reader left the site at the first tap and had nowhere to comment.
    href: `/news/${news.id}`,
    title: news.title,
    createdAt: news.publishedAt,
    imageUrl: news.imageUrl,
    summary: news.summary,
    sourceName: news.sourceName,
    sourceUrl: news.sourceUrl,
  };
}
