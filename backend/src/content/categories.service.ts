import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Kategorie bazy wiedzy — drzewo.
 *
 * Zwracane jako drzewo, nie płaska lista: menu i okruszki potrzebują
 * struktury, a składanie jej w przeglądarce oznaczałoby, że każdy klient
 * robi to samo inaczej.
 */
@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Drzewo kategorii razem z licznikiem materiałów.
   *
   * Licznik był surowym `_count.items` — czyli WSZYSTKIM, co leży
   * w kategorii: szkicami, materiałami w akceptacji, zarchiwizowanymi
   * i wszystkimi czterema typami naraz. Na zakładce „How To" widniało
   * więc „Sieć 3", choć instrukcja była jedna, a pozostałe dwa wpisy to
   * hasło wiki i artykuł. Liczba, której nie da się połączyć z tym, co
   * widać na liście, jest gorsza niż jej brak.
   *
   * Liczymy wyłącznie opublikowane, a `type` zawęża do jednego rodzaju —
   * ten sam filtr, którego użyje lista pod spodem.
   */
  async tree(type?: string) {
    const itemsWhere = {
      status: 'PUBLISHED' as const,
      ...(type && { type: type as any }),
    };

    const all = await this.prisma.contentCategory.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true, parentId: true, slug: true, name: true,
        description: true, icon: true, position: true,
        _count: { select: { items: { where: itemsWhere } } },
      },
    });

    type Node = (typeof all)[number] & { children: Node[] };
    const byId = new Map<number, Node>(all.map((c) => [c.id, { ...c, children: [] }]));
    const roots: Node[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async bySlug(slug: string) {
    const cat = await this.prisma.contentCategory.findUnique({
      where: { slug },
      include: {
        parent: { select: { id: true, slug: true, name: true } },
        children: { select: { id: true, slug: true, name: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!cat) throw new NotFoundException('Kategoria nie istnieje');
    return cat;
  }

  async create(data: any) {
    if (!data.name?.trim()) throw new BadRequestException('Nazwa kategorii jest wymagana');
    return this.prisma.contentCategory.create({
      data: {
        name: data.name.trim(),
        slug: await this.uniqueSlug(data.slug || data.name),
        description: data.description ?? null,
        icon: data.icon ?? null,
        parentId: data.parentId ?? null,
        position: data.position ?? 0,
      },
    });
  }

  async update(id: number, data: any) {
    await this.require(id);
    if (data.parentId === id) {
      throw new BadRequestException('Kategoria nie może być własnym rodzicem');
    }
    return this.prisma.contentCategory.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.slug && { slug: await this.uniqueSlug(data.slug, id) }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(data.position !== undefined && { position: data.position }),
      },
    });
  }

  async remove(id: number) {
    await this.require(id);
    const children = await this.prisma.contentCategory.count({ where: { parentId: id } });
    if (children > 0) {
      // Kasowanie z dziećmi zrobiłoby z nich kategorie główne bez ostrzeżenia.
      throw new BadRequestException('Najpierw przenieś lub usuń podkategorie');
    }
    await this.prisma.contentCategory.delete({ where: { id } });
    return { ok: true };
  }

  private async require(id: number) {
    const c = await this.prisma.contentCategory.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new NotFoundException('Kategoria nie istnieje');
    return c;
  }

  private async uniqueSlug(source: string, excludeId?: number) {
    const base = source.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'kategoria';
    let slug = base;
    for (let n = 2; n < 100; n++) {
      const clash = await this.prisma.contentCategory.findFirst({
        where: { slug, ...(excludeId && { id: { not: excludeId } }) }, select: { id: true },
      });
      if (!clash) return slug;
      slug = `${base}-${n}`;
    }
    return `${base}-${Date.now()}`;
  }
}
