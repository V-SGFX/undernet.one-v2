import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PremiumService } from '../premium/premium.service';
import { AUTOR_SELECT } from '../common/ozdoby';

const LIMIT_SPOLECZNOSCI = { darmowe: 2, pro: 20 };

@Injectable()
export class CommunitiesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private premium: PremiumService,
  ) {}

  private async getDiscussionCountMap(communityIds: number[]): Promise<Map<number, number>> {
    if (!communityIds.length) return new Map();

    const rows = await this.prisma.post.groupBy({
      by: ['communityId'],
      where: {
        isDeleted: false,
        communityId: { in: communityIds },
        type: { not: 'CLIP' },
      },
      _count: { _all: true },
    });

    return new Map(rows.map((r) => [r.communityId || 0, r._count._all]));
  }

  private applyDiscussionCounts<T extends { id: number; postCount: number }>(communities: T[], countMap: Map<number, number>): T[] {
    return communities.map((c) => ({ ...c, postCount: countMap.get(c.id) || 0 }));
  }

  /**
   * Licznik grupy obejmuje jej podkategorie.
   *
   * Wątki wiszą na konkretnej podkategorii, więc grupa „Technologia"
   * pokazywałaby zero, choć w Linuksie pod nią leży kilka dyskusji — i cały
   * dział wyglądałby na martwy.
   *
   * `postCountWlasny` zostaje osobno, bo to on rozstrzyga o indeksowaniu:
   * strona grupy z samą listą podkategorii, bez ani jednego własnego wątku,
   * nie ma treści do zaindeksowania, choćby suma z dzieci była duża.
   */
  private sumujPodkategorie<T extends { id: number; parentId: number | null; postCount: number }>(
    communities: T[],
  ): (T & { postCountWlasny: number })[] {
    const wDzieciach = new Map<number, number>();
    for (const c of communities) {
      if (c.parentId == null) continue;
      wDzieciach.set(c.parentId, (wDzieciach.get(c.parentId) ?? 0) + c.postCount);
    }
    return communities.map((c) => ({
      ...c,
      postCountWlasny: c.postCount,
      postCount: c.postCount + (wDzieciach.get(c.id) ?? 0),
    }));
  }

  // ─── LIST ALL COMMUNITIES ─────────────────────────────

  async findAll(userId?: number) {
    const cacheKey = 'communities:all';
    let communities: any[];

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      communities = JSON.parse(cached);
    } else {
      communities = await this.prisma.community.findMany({
        orderBy: { memberCount: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          color: true,
          iconUrl: true,
          bannerUrl: true,
          isOfficial: true,
          postCount: true,
          memberCount: true,
          createdAt: true,
          parentId: true,
          position: true,
          createdBy: { select: { ...AUTOR_SELECT } },
        },
      });
      const countMap = await this.getDiscussionCountMap(communities.map((c) => c.id));
      communities = this.applyDiscussionCounts(communities, countMap);
        communities = this.sumujPodkategorie(communities);
      await this.redis.set(cacheKey, JSON.stringify(communities), 60);
    }

    if (userId) {
      const memberships = await this.prisma.communityMember.findMany({
        where: { userId },
        select: { communityId: true },
      });
      const joinedIds = new Set(memberships.map(m => m.communityId));
      return communities.map(c => ({ ...c, isJoined: joinedIds.has(c.id) }));
    }

    return communities.map(c => ({ ...c, isJoined: false }));
  }

  // ─── TRENDING COMMUNITIES ─────────────────────────────

  async findTrending(userId?: number) {
    const cacheKey = 'communities:trending';
    let communities: any[];

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      communities = JSON.parse(cached);
    } else {
      communities = await this.prisma.community.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          color: true,
          iconUrl: true,
          isOfficial: true,
          postCount: true,
          memberCount: true,
        },
      });
      const countMap = await this.getDiscussionCountMap(communities.map((c) => c.id));
      communities = this.applyDiscussionCounts(communities, countMap)
        .sort((a, b) => {
          if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
          return b.postCount - a.postCount;
        })
        .slice(0, 10);
      await this.redis.set(cacheKey, JSON.stringify(communities), 120);
    }

    if (userId) {
      const memberships = await this.prisma.communityMember.findMany({
        where: { userId },
        select: { communityId: true },
      });
      const joinedIds = new Set(memberships.map(m => m.communityId));
      return communities.map(c => ({ ...c, isJoined: joinedIds.has(c.id) }));
    }

    return communities.map(c => ({ ...c, isJoined: false }));
  }

  // ─── MY COMMUNITIES ──────────────────────────────────

  async findMyCommunities(userId: number) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            iconUrl: true,
            postCount: true,
            memberCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return memberships.map(m => ({ ...m.community, isJoined: true }));
  }

  // ─── GET BY SLUG ──────────────────────────────────────

  async findBySlug(slug: string, userId?: number) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        iconUrl: true,
        bannerUrl: true,
        isOfficial: true,
        postCount: true,
        memberCount: true,
        createdAt: true,
        parentId: true,
        position: true,
        // Identyfikatory podkategorii — potrzebne, żeby policzyć wątki grupy.
        children: { select: { id: true } },
        createdBy: { select: { ...AUTOR_SELECT } },
        moderators: {
          select: { user: { select: { ...AUTOR_SELECT } } },
        },
      },
    });

    if (!community) throw new NotFoundException('Community not found');

    /*
     * Licznik grupy obejmuje jej podkategorie — tak samo jak na liście.
     *
     * Bez tego pojedynczy dział zwracał zero dla każdej grupy, bo wątki
     * wiszą na podkategoriach. Skutek był sprzeczny: mapa witryny zgłaszała
     * grupę jako wartą zaindeksowania (bo lista sumowała), a jej własna
     * strona odsyłała robota z `noindex` (bo tu suma nie zachodziła).
     */
    const dzieci = (community as any).children?.map((c: { id: number }) => c.id) ?? [];
    const countMap = await this.getDiscussionCountMap([community.id, ...dzieci]);
    const wlasne = countMap.get(community.id) || 0;
    const wDzieciach = dzieci.reduce((sum: number, id: number) => sum + (countMap.get(id) || 0), 0);

    const { children, ...bezDzieci } = community as any;
    const normalizedCommunity = {
      ...bezDzieci,
      postCount: wlasne + wDzieciach,
      postCountWlasny: wlasne,
    };

    let isJoined = false;
    if (userId) {
      const membership = await this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId } },
      });
      isJoined = !!membership;
    }

    return { ...normalizedCommunity, isJoined };
  }

  // ─── CREATE COMMUNITY ────────────────────────────────

  /**
   * Ile społeczności wolno założyć.
   *
   * Limit jest po to, żeby jedno konto nie zajęło setki nazw na zapas.
   * Gdy przełącznik `community-extras` jest wyłączony, `canUse` zwraca
   * `true` każdemu i obowiązuje wyłącznie próg dla PRO — czyli nikomu
   * niczego nie odbieramy, dopóki funkcja nie zostanie włączona.
   */

  async create(userId: number, data: { name: string; description?: string; color?: string; iconUrl?: string }) {
    const rozszerzone = await this.premium.canUse(userId, 'community-extras');
    const limit = rozszerzone ? LIMIT_SPOLECZNOSCI.pro : LIMIT_SPOLECZNOSCI.darmowe;
    const zalozonych = await this.prisma.community.count({ where: { createdById: userId } });
    if (zalozonych >= limit) {
      throw new ForbiddenException(
        rozszerzone
          ? `Limit ${limit} założonych społeczności na konto.`
          : `Darmowe konto może założyć ${limit} społeczności. Więcej daje UNDERNET PRO.`,
      );
    }

    const slug = data.name
      .toLowerCase()
      .replace(/[\u0105\u0104]/g, 'a').replace(/[\u0107\u0106]/g, 'c').replace(/[\u0119\u0118]/g, 'e')
      .replace(/[\u0142\u0141]/g, 'l').replace(/[\u0144\u0143]/g, 'n').replace(/[\u00f3\u00d3]/g, 'o')
      .replace(/[\u015b\u015a]/g, 's').replace(/[\u017a\u0179\u017c\u017b]/g, 'z')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);

    const existing = await this.prisma.community.findFirst({
      where: { OR: [{ slug }, { name: data.name }] },
    });
    if (existing) throw new ConflictException('Community with this name already exists');

    const community = await this.prisma.$transaction(async (tx) => {
      const c = await tx.community.create({
        data: {
          name: data.name,
          slug,
          description: data.description,
          color: data.color || '#6366f1',
          iconUrl: data.iconUrl,
          createdById: userId,
          memberCount: 1,
        },
        select: {
          id: true, name: true, slug: true, description: true,
          color: true, iconUrl: true, postCount: true, memberCount: true,
        },
      });

      await tx.communityMember.create({ data: { communityId: c.id, userId } });
      await tx.communityModerator.create({ data: { communityId: c.id, userId } });

      return c;
    });

    await this.redis.delPattern('communities:*');
    return { ...community, isJoined: true };
  }

  // ─── JOIN COMMUNITY ───────────────────────────────────

  async join(communityId: number, userId: number) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');

    const ban = await this.prisma.communityBan.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (ban) throw new ForbiddenException('You are banned from this community');

    const existing = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (existing) return { message: 'Already joined', memberCount: community.memberCount, isJoined: true };

    await this.prisma.$transaction([
      this.prisma.communityMember.create({ data: { communityId, userId } }),
      this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { increment: 1 } },
      }),
    ]);

    await this.redis.delPattern('communities:*');
    return { message: 'Joined', memberCount: community.memberCount + 1, isJoined: true };
  }

  // ─── LEAVE COMMUNITY ─────────────────────────────────

  async leave(communityId: number, userId: number) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');

    const existing = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!existing) return { message: 'Not a member', memberCount: community.memberCount, isJoined: false };

    await this.prisma.$transaction([
      this.prisma.communityMember.delete({
        where: { communityId_userId: { communityId, userId } },
      }),
      this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);

    await this.redis.delPattern('communities:*');
    return { message: 'Left', memberCount: Math.max(0, community.memberCount - 1), isJoined: false };
  }
}
