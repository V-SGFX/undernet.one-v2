import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Autorzy.
 *
 * Osobno od `User`, bo autorem bywa ktoś bez konta: redakcja, gość,
 * autor historyczny. `userId` jest opcjonalne i unikalne — jedno konto
 * ma najwyżej jeden profil autora, ale profil autora nie wymaga konta.
 */
@Injectable()
export class AuthorsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.author.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, slug: true, name: true, bio: true, avatarUrl: true, website: true,
        _count: { select: { contentItems: true } },
      },
    });
  }

  async bySlug(slug: string) {
    const author = await this.prisma.author.findUnique({
      where: { slug },
      select: {
        id: true, slug: true, name: true, bio: true, avatarUrl: true, website: true,
        _count: { select: { contentItems: true } },
      },
    });
    if (!author) throw new NotFoundException('Autor nie istnieje');
    return author;
  }

  async create(data: any) {
    if (!data.name?.trim()) throw new BadRequestException('Nazwa autora jest wymagana');
    return this.prisma.author.create({
      data: {
        name: data.name.trim(),
        slug: await this.uniqueSlug(data.slug || data.name),
        bio: data.bio ?? null,
        avatarUrl: data.avatarUrl ?? null,
        website: data.website ?? null,
        userId: data.userId ?? null,
      },
    });
  }

  async update(id: number, data: any) {
    await this.require(id);
    return this.prisma.author.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.slug && { slug: await this.uniqueSlug(data.slug, id) }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.userId !== undefined && { userId: data.userId }),
      },
    });
  }

  async remove(id: number) {
    await this.require(id);
    // Materiały zostają — `ContentItem.authorId` jest SetNull. Usunięcie
    // autora nie może kasować tego, co napisał.
    await this.prisma.author.delete({ where: { id } });
    return { ok: true };
  }

  private async require(id: number) {
    const a = await this.prisma.author.findUnique({ where: { id }, select: { id: true } });
    if (!a) throw new NotFoundException('Autor nie istnieje');
    return a;
  }

  private async uniqueSlug(source: string, excludeId?: number) {
    const base = source.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'autor';
    let slug = base;
    for (let n = 2; n < 100; n++) {
      const clash = await this.prisma.author.findFirst({
        where: { slug, ...(excludeId && { id: { not: excludeId } }) }, select: { id: true },
      });
      if (!clash) return slug;
      slug = `${base}-${n}`;
    }
    return `${base}-${Date.now()}`;
  }
}
