import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AUTOR_SELECT } from '../common/ozdoby';

/** Co da się obserwować. Dokładnie jedno pole celu jest wypełnione. */
export type FollowTarget = 'community' | 'tag' | 'author' | 'post';

const FIELD: Record<FollowTarget, 'communityId' | 'tagId' | 'authorId' | 'postId'> = {
  community: 'communityId',
  tag: 'tagId',
  author: 'authorId',
  post: 'postId',
};

/**
 * Obserwowanie.
 *
 * Wersja z xdtv obserwowała wyłącznie profile streamerów i trzymała licznik
 * obserwujących na profilu. Tutaj celów jest cztery, a licznika nie ma —
 * `memberCount` społeczności liczy członków, nie obserwujących, i mieszanie
 * tych dwóch rzeczy w jednej kolumnie kończy się liczbą, której nikt nie
 * umie wytłumaczyć.
 */
@Injectable()
export class FollowsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async toggle(userId: number, target: FollowTarget, targetId: number) {
    const field = FIELD[target];
    if (!field) throw new BadRequestException(`Nieznany typ obserwacji: ${target}`);

    const existing = await this.prisma.follow.findFirst({
      where: { userId, [field]: targetId },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.follow.delete({ where: { id: existing.id } });
      await this.invalidate(userId);
      return { following: false };
    }

    /*
     * Wyścig dwóch kliknięć kończył się błędem 500.
     *
     * Między `findFirst` a `create` jest okno, w które mieści się drugie
     * żądanie tego samego użytkownika — a że w bazie stoi ograniczenie
     * unikalności na parze (użytkownik, cel), drugi zapis wychodził jako
     * nieobsłużony `PrismaClientKnownRequestError` i leciał do
     * odwiedzającego jako awaria serwera.
     *
     * Ograniczenie zrobiło dokładnie to, po co jest — nie wpuściło
     * duplikatu. Błędem była reakcja na nie. Skoro obserwacja już
     * istnieje, to stan, o który prosił użytkownik, JEST osiągnięty:
     * odpowiadamy powodzeniem, zamiast krzyczeć o kolizji.
     */
    try {
      await this.prisma.follow.create({ data: { userId, [field]: targetId } });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
    }
    await this.invalidate(userId);
    return { following: true };
  }

  /** Wszystko, co obserwuje użytkownik — jednym zapytaniem. */
  async list(userId: number) {
    const rows = await this.prisma.follow.findMany({
      where: { userId },
      include: {
        community: { select: { id: true, slug: true, name: true, iconUrl: true } },
        tag: { select: { id: true, slug: true, name: true } },
        author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
        post: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      communities: rows.filter((r) => r.community).map((r) => r.community),
      tags: rows.filter((r) => r.tag).map((r) => r.tag),
      authors: rows.filter((r) => r.author).map((r) => r.author),
      posts: rows.filter((r) => r.post).map((r) => r.post),
    };
  }

  /**
   * Zapisane wątki — pełne wpisy, gotowe dla ściany.
   *
   * Zakładka „Zapisane" w profilu wołała `/follows/posts/me`, którego nie
   * było: kontroler miał wyłącznie listę wszystkiego i przełącznik. Wpisy
   * dawały się zapisać, ale nie dało się ich potem zobaczyć.
   */
  async savedPosts(userId: number, limit = 48) {
    const rows = await this.prisma.follow.findMany({
      where: { userId, NOT: { postId: null } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
      include: {
        post: {
          include: {
            author: { select: { ...AUTOR_SELECT } },
            community: { select: { id: true, slug: true, name: true, iconUrl: true, color: true } },
            tags: { include: { tag: true } },
            images: { orderBy: { order: 'asc' }, select: { id: true, url: true, order: true } },
          },
        },
      },
    });

    // Wpis mógł zostać skasowany po zapisaniu — wtedy zostaje sama obserwacja.
    const data = rows.map((r) => r.post).filter((p) => p && !p.isDeleted);
    return { data, meta: { total: data.length, limit } };
  }

  /** Czy użytkownik zapisał ten wątek. */
  async isPostSaved(userId: number, postId: number) {
    const row = await this.prisma.follow.findFirst({
      where: { userId, postId }, select: { id: true },
    });
    return { following: Boolean(row) };
  }

  /**
   * Stan zapisania dla wielu wątków naraz.
   *
   * Ściana z 24 kafelkami pytałaby inaczej 24 razy — jedno zapytanie
   * zamiast dwudziestu czterech.
   */
  async arePostsSaved(userId: number, ids: number[]) {
    if (ids.length === 0) return {};
    const rows = await this.prisma.follow.findMany({
      where: { userId, postId: { in: ids } },
      select: { postId: true },
    });
    const saved = new Set(rows.map((r) => r.postId));
    return Object.fromEntries(ids.map((id) => [id, saved.has(id)]));
  }

  /** Identyfikatory obserwowanych celów danego typu — używane przez kanał. */
  async idsOf(userId: number, target: FollowTarget): Promise<number[]> {
    const field = FIELD[target];
    const rows = await this.prisma.follow.findMany({
      where: { userId, NOT: { [field]: null } },
      select: { [field]: true },
    });
    return rows.map((r) => (r as Record<string, number>)[field]).filter(Boolean);
  }

  private async invalidate(userId: number) {
    // Kanał personalizowany jest budowany z obserwacji, więc po każdej
    // zmianie musi zostać przeliczony.
    await this.redis.delPattern(`feed:v2:u${userId}:*`).catch(() => undefined);
  }
}
