import {
  Injectable, Logger, ForbiddenException, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PremiumService } from '../premium/premium.service';

const MAX_ALERTOW = 25;
const MIN_FRAZY = 3;

/**
 * Alerty i monitoring obserwowanych tematów.
 *
 * Jeden mechanizm, dwa zastosowania — i to nie oszczędność, tylko sedno:
 *
 *  • ALERT to fraza pilnowana WSZĘDZIE („napisz mi, gdy ktokolwiek wspomni
 *    o ZFS-ie"),
 *  • MONITORING to podsumowanie z miejsc, które ktoś już obserwuje
 *    („co się działo w c/sieci przez tydzień").
 *
 * Obie odpowiadają na pytanie „co mnie ominęło", więc chodzą tym samym
 * przebiegiem i lądują w tej samej skrzynce powiadomień.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private prisma: PrismaService,
    private premium: PremiumService,
  ) {}

  private async wymagajDostepu(userId: number, klucz: string) {
    if (!(await this.premium.canUse(userId, klucz))) {
      throw new ForbiddenException(
        klucz === 'alerts'
          ? 'Alerty są częścią UNDERNET PRO.'
          : 'Monitoring tematów jest częścią UNDERNET PRO.',
      );
    }
  }

  async list(userId: number) {
    return this.prisma.alert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async create(userId: number, data: { phrase?: string; scope?: string }) {
    await this.wymagajDostepu(userId, 'alerts');

    const phrase = data.phrase?.trim();
    if (!phrase || phrase.length < MIN_FRAZY) {
      throw new BadRequestException(`Fraza musi mieć co najmniej ${MIN_FRAZY} znaki.`);
    }

    const ile = await this.prisma.alert.count({ where: { userId } });
    if (ile >= MAX_ALERTOW) {
      throw new BadRequestException(`Limit ${MAX_ALERTOW} alertów na konto.`);
    }
    if (await this.prisma.alert.findFirst({ where: { userId, phrase } })) {
      throw new BadRequestException('Taki alert już masz.');
    }

    /*
     * Zaczynamy od BIEŻĄCEGO końca, nie od zera.
     *
     * Inaczej pierwszy przebieg po założeniu alertu przeorałby całe
     * archiwum i wysypał kilkadziesiąt powiadomień naraz — o rzeczach
     * sprzed miesięcy, których nikt nie prosił, żeby pilnować.
     */
    const [ostatniPost, ostatniMaterial] = await Promise.all([
      this.prisma.post.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }),
      this.prisma.contentItem.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }),
    ]);

    return this.prisma.alert.create({
      data: {
        userId,
        phrase,
        scope: (data.scope as any) ?? 'BOTH',
        lastPostId: ostatniPost?.id ?? 0,
        lastItemId: ostatniMaterial?.id ?? 0,
      },
    });
  }

  async toggle(userId: number, id: number) {
    const a = await this.prisma.alert.findUnique({ where: { id } });
    if (!a || a.userId !== userId) throw new NotFoundException('Nie ma takiego alertu');
    return this.prisma.alert.update({ where: { id }, data: { isActive: !a.isActive } });
  }

  async remove(userId: number, id: number) {
    const a = await this.prisma.alert.findUnique({ where: { id } });
    if (!a || a.userId !== userId) throw new NotFoundException('Nie ma takiego alertu');
    await this.prisma.alert.delete({ where: { id } });
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PRZEBIEG
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Sprawdzenie alertów co 15 minut.
   *
   * Każdy alert pamięta, dokąd doszedł (`lastPostId` / `lastItemId`), więc
   * przebieg ogląda wyłącznie to, co przybyło. Bez tego znacznika koszt
   * rósłby z archiwum, a użytkownik dostawałby powtórki.
   */
  @Cron('*/15 * * * *')
  async sprawdzAlerty() {
    const alerty = await this.prisma.alert.findMany({ where: { isActive: true } });
    if (alerty.length === 0) return;

    let trafien = 0;
    for (const a of alerty) {
      try {
        // Alert bez opłaconego PRO milczy, ale NIE jest kasowany:
        // po odnowieniu ma działać dalej, bez zakładania od nowa.
        if (!(await this.premium.canUse(a.userId, 'alerts'))) continue;
        trafien += await this.sprawdzJeden(a);
      } catch (e: any) {
        this.logger.error(`Alert #${a.id}: ${e?.message}`);
      }
    }
    if (trafien > 0) this.logger.log(`Alerty: ${trafien} trafień`);
  }

  private async sprawdzJeden(a: any): Promise<number> {
    const fraza = a.phrase;
    let trafien = 0;
    let nowyPost = a.lastPostId;
    let nowyMaterial = a.lastItemId;

    if (a.scope === 'POSTS' || a.scope === 'BOTH') {
      const posty = await this.prisma.post.findMany({
        where: {
          id: { gt: a.lastPostId },
          isDeleted: false,
          // Własny wpis nie jest odkryciem — nie zawiadamiamy o sobie.
          NOT: { authorId: a.userId },
          OR: [
            { title: { contains: fraza, mode: 'insensitive' } },
            { content: { contains: fraza, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true },
        take: 20,
      });
      const max = await this.prisma.post.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
      nowyPost = max?.id ?? a.lastPostId;

      for (const post of posty) {
        await this.powiadom(a.userId, `„${fraza}" w wątku: ${post.title}`, { postId: post.id });
        trafien += 1;
      }
    }

    if (a.scope === 'CONTENT' || a.scope === 'BOTH') {
      const materialy = await this.prisma.contentItem.findMany({
        where: {
          id: { gt: a.lastItemId },
          status: 'PUBLISHED',
          OR: [
            { title: { contains: fraza, mode: 'insensitive' } },
            { excerpt: { contains: fraza, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true },
        take: 20,
      });
      const max = await this.prisma.contentItem.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
      nowyMaterial = max?.id ?? a.lastItemId;

      for (const m of materialy) {
        await this.powiadom(a.userId, `„${fraza}" w materiale: ${m.title}`, {});
        trafien += 1;
      }
    }

    await this.prisma.alert.update({
      where: { id: a.id },
      data: {
        lastPostId: nowyPost,
        lastItemId: nowyMaterial,
        ...(trafien > 0 && { hitCount: { increment: trafien } }),
      },
    });
    return trafien;
  }

  private async powiadom(userId: number, message: string, cel: { postId?: number }) {
    await this.prisma.notification
      .create({
        data: { userId, type: 'ALERT_MATCH', message, postId: cel.postId ?? null },
      })
      .catch(() => undefined);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MONITORING OBSERWOWANYCH TEMATÓW
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Podsumowanie raz na dobę, o ósmej rano.
   *
   * Zawiadamiamy TYLKO gdy coś przybyło. Powiadomienie „w Twoich
   * społecznościach nic się nie działo" jest gorsze niż cisza: uczy
   * ignorować całą skrzynkę.
   */
  @Cron('0 8 * * *')
  async podsumowanieTematow() {
    const obserwujacy = await this.prisma.follow.findMany({
      where: { OR: [{ NOT: { communityId: null } }, { NOT: { tagId: null } }] },
      select: { userId: true, communityId: true, tagId: true },
    });
    if (obserwujacy.length === 0) return;

    const wgUzytkownika = new Map<number, { spolecznosci: number[]; tagi: number[] }>();
    for (const f of obserwujacy) {
      const wpis = wgUzytkownika.get(f.userId) ?? { spolecznosci: [], tagi: [] };
      if (f.communityId) wpis.spolecznosci.push(f.communityId);
      if (f.tagId) wpis.tagi.push(f.tagId);
      wgUzytkownika.set(f.userId, wpis);
    }

    const doba = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let wyslanych = 0;

    for (const [userId, cele] of wgUzytkownika) {
      try {
        if (!(await this.premium.canUse(userId, 'topic-monitoring'))) continue;

        const ile = await this.prisma.post.count({
          where: {
            isDeleted: false,
            createdAt: { gte: doba },
            NOT: { authorId: userId },
            OR: [
              ...(cele.spolecznosci.length ? [{ communityId: { in: cele.spolecznosci } }] : []),
              ...(cele.tagi.length ? [{ tags: { some: { tagId: { in: cele.tagi } } } }] : []),
            ],
          },
        });
        if (ile === 0) continue;

        await this.prisma.notification.create({
          data: {
            userId,
            type: 'TOPIC_DIGEST',
            message: `W obserwowanych tematach przybyło ${ile} ${ile === 1 ? 'wątek' : ile < 5 ? 'wątki' : 'wątków'} przez ostatnią dobę.`,
          },
        });
        wyslanych += 1;
      } catch (e: any) {
        this.logger.error(`Podsumowanie dla #${userId}: ${e?.message}`);
      }
    }
    if (wyslanych > 0) this.logger.log(`Podsumowania tematów: ${wyslanych}`);
  }
}
