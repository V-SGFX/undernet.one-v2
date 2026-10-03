import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AUTOR_SELECT } from '../common/ozdoby';

/** Czym wolno zawęzić wyszukiwanie. Wszystko opcjonalne. */
export interface FiltrySzukania {
  /** NEWS | ARTICLE | HOWTO | WIKI */
  typ?: string;
  kategoria?: string;
  autor?: string;
  spolecznosc?: string;
  /** Daty w formacie ISO. */
  od?: string;
  do?: string;
  /** Szukaj także w pełnej treści, nie tylko w tytule i zajawce. */
  wTresci?: boolean;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(query: string, limit: number = 10, filtry: FiltrySzukania = {}) {
    if (!query || query.trim().length < 2) return { content: [], posts: [], users: [], news: [] };

    const q = query.trim();

    /*
     * Filtry — część UNDERNET PRO.
     *
     * Bez nich wyszukiwarka szukała po tytule i treści, i na tym koniec.
     * Na portalu, gdzie ta sama nazwa narzędzia pada w haśle wiki,
     * w instrukcji i w trzech wątkach, „szukaj" bez zawężenia zwraca
     * wszystko naraz — czyli w praktyce nic.
     *
     * Warstwa dostępu siedzi w kontrolerze; tutaj filtry albo są, albo
     * ich nie ma. Serwis nie powinien wiedzieć, kto za co zapłacił.
     */
    const odKiedy = filtry.od ? new Date(filtry.od) : undefined;
    const doKiedy = filtry.do ? new Date(filtry.do) : undefined;
    const zakresDat =
      odKiedy || doKiedy
        ? { ...(odKiedy && { gte: odKiedy }), ...(doKiedy && { lte: doKiedy }) }
        : undefined;

    const wspolneContent: any = {
      status: 'PUBLISHED',
      ...(filtry.typ && { type: filtry.typ }),
      ...(filtry.kategoria && { category: { slug: filtry.kategoria } }),
      ...(filtry.autor && { author: { slug: filtry.autor } }),
      ...(zakresDat && { publishedAt: zakresDat }),
    };

    const [content, posts, users, news] = await Promise.all([
      // Pierwsza pula to baza wiedzy, nie profile streamerów: undernet
      // szuka odpowiedzi, a nie ludzi. Tylko materiały opublikowane —
      // szkic w akceptacji nie jest odpowiedzią.
      this.prisma.contentItem.findMany({
        where: {
          ...wspolneContent,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { excerpt: { contains: q, mode: 'insensitive' } },
            // Treść w wyszukiwaniu ma sens dopiero przy filtrach: bez nich
            // hasło „docker" trafiałoby w każdy tekst, który je wspomina.
            ...(filtry.wTresci ? [{ body: { contains: q, mode: 'insensitive' as const } }] : []),
          ],
        },
        select: {
          id: true, type: true, slug: true, title: true, excerpt: true, publishedAt: true,
          author: { select: { id: true, slug: true, name: true } },
          category: { select: { id: true, slug: true, name: true } },
        },
        take: limit,
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.post.findMany({
        where: {
          isDeleted: false,
          type: { not: 'CLIP' },
          ...(filtry.spolecznosc && { community: { slug: filtry.spolecznosc } }),
          ...(zakresDat && { createdAt: zakresDat }),
          OR: [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }],
        },
        select: {
          id: true, title: true, content: true, type: true, createdAt: true, upvotes: true, downvotes: true, commentCount: true,
          author: { select: { ...AUTOR_SELECT } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findMany({
        where: {
          isActive: true,
          OR: [{ username: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }],
        },
        select: { ...AUTOR_SELECT },
        take: limit,
      }),
      // News to ContentItem typu NEWS — po scaleniu nie ma osobnej tabeli.
      this.prisma.contentItem.findMany({
        where: {
          type: 'NEWS',
          status: 'PUBLISHED',
          ...(filtry.kategoria && { category: { slug: filtry.kategoria } }),
          ...(zakresDat && { publishedAt: zakresDat }),
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { excerpt: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, slug: true, title: true, excerpt: true, coverUrl: true, publishedAt: true },
        take: limit,
        orderBy: { publishedAt: 'desc' },
      }),
    ]);

    return { content, posts, users, news };
  }
}
