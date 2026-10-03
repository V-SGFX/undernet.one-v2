import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PremiumService } from '../premium/premium.service';

/** Ile kolekcji wolno założyć. Zapora przed przypadkową pętlą, nie limit handlowy. */
const MAX_KOLEKCJI = 100;

/**
 * Kolekcje — nazwane zbiory zapisanych rzeczy.
 *
 * Osobno od zakładek i to jest sedno podziału: zakładka („zapisz na
 * później") zostaje DARMOWA, bo działa od dawna i odebranie jej byłoby
 * cofnięciem funkcji. Kolekcja jest warstwą wyżej — porządkowaniem — i to
 * ona podlega przełącznikowi `collections` w panelu.
 */
@Injectable()
export class CollectionsService {
  constructor(
    private prisma: PrismaService,
    private premium: PremiumService,
  ) {}

  /**
   * Sprawdzenie dostępu.
   *
   * Osobna metoda, bo woła ją każda operacja zapisu. Odczyt świadomie
   * NIE jest chroniony: gdyby ktoś stracił PRO, ma prawo zobaczyć to,
   * co już zebrał, i przenieść gdzie indziej. Odcięcie własnych danych
   * to kara, nie ograniczenie funkcji.
   */
  private async wymagajDostepu(userId: number) {
    const wolno = await this.premium.canUse(userId, 'collections');
    if (!wolno) {
      throw new ForbiddenException(
        'Kolekcje są częścią UNDERNET PRO. Zakładki („Zapisz") działają bez niego.',
      );
    }
  }

  async list(userId: number) {
    return this.prisma.collection.findMany({
      where: { userId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
  }

  async byId(userId: number, id: number) {
    const kolekcja = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: 'desc' },
          include: {
            post: {
              select: {
                id: true, title: true, type: true, commentCount: true, createdAt: true,
                community: { select: { slug: true, name: true } },
              },
            },
            contentItem: {
              select: {
                id: true, type: true, slug: true, title: true, excerpt: true,
                coverUrl: true, readingTime: true, publishedAt: true,
              },
            },
          },
        },
      },
    });
    if (!kolekcja) throw new NotFoundException('Kolekcja nie istnieje');
    if (kolekcja.userId !== userId) throw new ForbiddenException('To nie jest Twoja kolekcja');
    return kolekcja;
  }

  async create(userId: number, data: { name?: string; description?: string }) {
    await this.wymagajDostepu(userId);

    const name = data.name?.trim();
    if (!name) throw new BadRequestException('Nazwa kolekcji jest wymagana');

    const ile = await this.prisma.collection.count({ where: { userId } });
    if (ile >= MAX_KOLEKCJI) {
      throw new BadRequestException(`Limit ${MAX_KOLEKCJI} kolekcji na konto.`);
    }

    const istnieje = await this.prisma.collection.findFirst({ where: { userId, name } });
    if (istnieje) throw new BadRequestException('Masz już kolekcję o tej nazwie');

    return this.prisma.collection.create({
      data: { userId, name, description: data.description?.trim() || null, position: ile * 10 },
    });
  }

  async update(userId: number, id: number, data: { name?: string; description?: string; position?: number }) {
    await this.wymagajDostepu(userId);
    await this.byId(userId, id);

    const name = data.name?.trim();
    if (name) {
      const kolizja = await this.prisma.collection.findFirst({
        where: { userId, name, NOT: { id } },
      });
      if (kolizja) throw new BadRequestException('Masz już kolekcję o tej nazwie');
    }

    return this.prisma.collection.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.position !== undefined && { position: data.position }),
      },
    });
  }

  async remove(userId: number, id: number) {
    await this.byId(userId, id);
    // Bez sprawdzania PRO: kasowanie własnych danych musi działać zawsze.
    await this.prisma.collection.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Dodanie pozycji.
   *
   * Dokładnie jedno z pól celu — wątek ALBO materiał. Dwa naraz oznaczają
   * pomyłkę po stronie wołającego, a nie „obydwa".
   */
  async addItem(
    userId: number,
    collectionId: number,
    data: { postId?: number; contentItemId?: number; note?: string },
  ) {
    await this.wymagajDostepu(userId);
    await this.byId(userId, collectionId);

    const { postId, contentItemId } = data;
    if (Boolean(postId) === Boolean(contentItemId)) {
      throw new BadRequestException('Podaj dokładnie jedno: postId albo contentItemId');
    }

    if (postId) {
      const istnieje = await this.prisma.post.count({ where: { id: postId, isDeleted: false } });
      if (!istnieje) throw new NotFoundException('Nie ma takiego wątku');
    } else {
      const istnieje = await this.prisma.contentItem.count({ where: { id: contentItemId } });
      if (!istnieje) throw new NotFoundException('Nie ma takiego materiału');
    }

    const juzJest = await this.prisma.collectionItem.findFirst({
      where: { collectionId, ...(postId ? { postId } : { contentItemId }) },
    });
    if (juzJest) return juzJest;

    return this.prisma.collectionItem.create({
      data: {
        collectionId,
        postId: postId ?? null,
        contentItemId: contentItemId ?? null,
        note: data.note?.trim() || null,
      },
    });
  }

  async removeItem(userId: number, collectionId: number, itemId: number) {
    await this.byId(userId, collectionId);
    const item = await this.prisma.collectionItem.findUnique({ where: { id: itemId } });
    if (!item || item.collectionId !== collectionId) {
      throw new NotFoundException('Nie ma takiej pozycji w tej kolekcji');
    }
    await this.prisma.collectionItem.delete({ where: { id: itemId } });
    return { ok: true };
  }

  /**
   * W których kolekcjach leży dana rzecz.
   *
   * Używane przez przycisk „Dodaj do kolekcji", żeby od razu pokazać
   * zaznaczone te, w których już jest — zamiast kazać zgadywać.
   */
  async whereIs(userId: number, target: { postId?: number; contentItemId?: number }) {
    if (Boolean(target.postId) === Boolean(target.contentItemId)) return [];
    const items = await this.prisma.collectionItem.findMany({
      where: {
        collection: { userId },
        ...(target.postId ? { postId: target.postId } : { contentItemId: target.contentItemId }),
      },
      select: { collectionId: true },
    });
    return items.map((i) => i.collectionId);
  }
}
