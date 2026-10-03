import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MediaService } from '../media/media.service';
import { ContentType, ContentStatus, Prisma } from '@prisma/client';
import DOMPurify from 'isomorphic-dompurify';

/** Typ → fragment adresu publicznego. Musi zgadzać się z frontem. */
const PATH_BY_TYPE: Record<ContentType, string> = {
  NEWS: 'news',
  ARTICLE: 'articles',
  HOWTO: 'how-to',
  WIKI: 'wiki',
};

/**
 * Czyszczenie treści materiału.
 *
 * Robione przy ZAPISIE, nie przy odczycie: baza ma trzymać treść, którą
 * wolno pokazać, a nie taką, którą trzeba za każdym razem odkażać. Widok
 * i tak wstawia to przez `dangerouslySetInnerHTML`, a od dziś hasło wiki
 * może napisać każdy zalogowany — bez tego pierwsze zgłoszenie ze
 * znacznikiem `script` byłoby trwałym XSS-em, wystarczyłoby, że moderator
 * otworzy podgląd.
 *
 * Lista dopuszczonych znaczników jest szersza niż w postach, bo edytor
 * materiałów umie nagłówki, tabele i obrazki — i to są znaczniki, których
 * hasło wiki naprawdę potrzebuje.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'strong', 'em', 's', 'a', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'span', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'src', 'alt', 'title', 'colspan', 'rowspan'];

function sanitizeBody(html: string): string {
  return DOMPurify.sanitize(html ?? '', { ALLOWED_TAGS, ALLOWED_ATTR });
}

/** Pola tekstowe bez znaczników — tytuł czy zajawka to zwykły tekst. */
function sanitizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export interface ListOptions {
  type?: ContentType;
  status?: ContentStatus;
  categorySlug?: string;
  authorSlug?: string;
  tagSlug?: string;
  q?: string;
  page?: number;
  limit?: number;
  /** Kolejność: 'new' (domyślna) albo 'popular'. */
  sort?: string;
  /** Zawęża listę do materiałów jednego autora — po identyfikatorze `Author`. */
  onlyAuthorId?: number;
}

/**
 * Kto co może założyć.
 *
 * Zwykły użytkownik pisze wyłącznie do wiki i wyłącznie do akceptacji.
 * Wiki jest z natury wspólna — hasło o ASPM czy o kolejności zmiennych
 * w Compose może dopisać każdy, kto to przerabiał. News zostaje przy
 * redakcji, bo to głos serwisu, a nie czytelnika.
 */
const TYPES_BY_ROLE: Record<string, ContentType[]> = {
  USER: [ContentType.WIKI],
  MODERATOR: [ContentType.WIKI, ContentType.ARTICLE, ContentType.HOWTO],
  AUTHOR: [ContentType.WIKI, ContentType.ARTICLE, ContentType.HOWTO],
  EDITOR: [ContentType.WIKI, ContentType.ARTICLE, ContentType.HOWTO, ContentType.NEWS],
  ADMIN: [ContentType.WIKI, ContentType.ARTICLE, ContentType.HOWTO, ContentType.NEWS],
};

/** Role, które akceptują cudze materiały. „Moderacja wzwyż". */
const REVIEWER_ROLES = ['MODERATOR', 'EDITOR', 'ADMIN'];

export function canReview(role: string): boolean {
  return REVIEWER_ROLES.includes(role);
}

/** Pola listy. Treść materiału NIE wchodzi — lista dwudziestu artykułów
 *  z pełnym tekstem to kilkaset kilobajtów, z których widać trzy zdania. */
const LIST_SELECT = {
  id: true, type: true, status: true, slug: true, title: true, excerpt: true,
  coverUrl: true, readingTime: true, viewCount: true, commentCount: true,
  publishedAt: true, updatedAt: true,
  author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
  category: { select: { id: true, slug: true, name: true } },
  tags: { select: { tag: { select: { id: true, slug: true, name: true } } } },
} satisfies Prisma.ContentItemSelect;

/** Ile słów na minutę przy szacowaniu czasu czytania. */
const WORDS_PER_MINUTE = 200;

@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private media: MediaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  //  ODCZYT PUBLICZNY
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Lista materiałów.
   *
   * Domyślnie tylko opublikowane. Status podaje się jawnie i wyłącznie
   * ze Studia — inaczej szkic wyciekłby na listę publiczną przez sam
   * parametr w adresie.
   */
  async list(opts: ListOptions, includeUnpublished = false) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));

    const where: Prisma.ContentItemWhereInput = {
      ...(opts.type && { type: opts.type }),
      ...(opts.onlyAuthorId !== undefined && { authorId: opts.onlyAuthorId }),
      ...(includeUnpublished
        ? opts.status && { status: opts.status }
        : { status: ContentStatus.PUBLISHED }),
      /*
       * Kategoria ALBO jej podkategorie.
       *
       * Grupa („Technologia") nie ma własnych materiałów — wszystkie wiszą
       * na podkategoriach. Bez tego wejście w grupę dawałoby pustą listę,
       * choć pod nią leży dwieście pozycji. Dla podkategorii warunek zwęża
       * się sam do niej samej, bo dzieci nie ma.
       */
      ...(opts.categorySlug && {
        OR: [
          { category: { slug: opts.categorySlug } },
          { category: { parent: { slug: opts.categorySlug } } },
        ],
      }),
      ...(opts.authorSlug && { author: { slug: opts.authorSlug } }),
      ...(opts.tagSlug && { tags: { some: { tag: { slug: opts.tagSlug } } } }),
      ...(opts.q && {
        OR: [
          { title: { contains: opts.q, mode: 'insensitive' } },
          { excerpt: { contains: opts.q, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.ContentItemOrderByWithRelationInput[] =
      opts.sort === 'popular'
        ? [{ viewCount: 'desc' }, { publishedAt: 'desc' }]
        : [{ publishedAt: 'desc' }, { createdAt: 'desc' }];

    const cacheKey = includeUnpublished
      ? null
      : `content:list:${JSON.stringify({ ...opts, page, limit })}`;
    if (cacheKey) {
      const hit = await this.redis.get(cacheKey);
      if (hit) return JSON.parse(hit);
    }

    const [data, total] = await Promise.all([
      this.prisma.contentItem.findMany({
        where, orderBy, skip: (page - 1) * limit, take: limit, select: LIST_SELECT,
      }),
      this.prisma.contentItem.count({ where }),
    ]);

    const result = {
      data: data.map((i) => ({ ...i, tags: i.tags.map((t) => t.tag) })),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
    if (cacheKey) await this.redis.set(cacheKey, JSON.stringify(result), 120);
    return result;
  }

  /**
   * Materiał po typie i adresie.
   *
   * Para (type, slug) jest unikalna, więc `/wiki/docker` i `/how-to/docker`
   * mogą istnieć obok siebie — to dwie różne rzeczy o tej samej nazwie.
   */
  /**
   * Gdzie mieszka materiał o tym ślimaku — niezależnie od typu.
   *
   * Rodzaj materiału bywa zmieniany po publikacji: hasło wiki okazuje się
   * instrukcją, notka artykułem. Adres publiczny przenosi się wtedy
   * z `/wiki/x` na `/how-to/x`, a każdy odnośnik puszczony wcześniej
   * w świat — z listy, z wyszukiwarki, z czyjejś zakładki — prowadzi
   * donikąd. Strona pod starym adresem pyta tutaj i przekierowuje,
   * zamiast pokazywać 404.
   */
  async resolveSlug(slug: string): Promise<{ type: ContentType; slug: string } | null> {
    const item = await this.prisma.contentItem.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED },
      select: { type: true, slug: true },
    });
    return item ?? null;
  }

  async bySlug(type: ContentType, slug: string, viewerRole?: string) {
    const item = await this.prisma.contentItem.findUnique({
      where: { type_slug: { type, slug } },
      include: {
        author: { select: { id: true, slug: true, name: true, avatarUrl: true, bio: true, website: true } },
        category: { select: { id: true, slug: true, name: true, parentId: true } },
        tags: { select: { tag: { select: { id: true, slug: true, name: true } } } },
        sourcePost: {
          select: {
            id: true, title: true, commentCount: true,
            community: { select: { slug: true, name: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Materiał nie istnieje');

    const canSeeDraft = viewerRole === 'ADMIN' || viewerRole === 'EDITOR';
    if (item.status !== ContentStatus.PUBLISHED && !canSeeDraft) {
      // Nieopublikowany materiał odpowiada tak samo jak nieistniejący.
      // Rozróżnienie zdradzałoby, że pod tym adresem coś powstaje.
      throw new NotFoundException('Materiał nie istnieje');
    }

    // Licznik odsłon poza ścieżką odpowiedzi — czytelnik nie czeka na zapis.
    this.prisma.contentItem
      .update({ where: { id: item.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    return { ...item, tags: item.tags.map((t) => t.tag) };
  }

  /**
   * Materiały powiązane.
   *
   * Bez silnika rekomendacji: najpierw jawnie wskazane relacje, potem
   * dopełnienie z tej samej kategorii. To wystarcza, dopóki materiałów
   * są setki, a nie dziesiątki tysięcy.
   */
  async related(id: number, limit = 6) {
    const item = await this.prisma.contentItem.findUnique({
      where: { id },
      select: { id: true, categoryId: true, type: true },
    });
    if (!item) throw new NotFoundException('Materiał nie istnieje');

    const explicit = await this.prisma.contentRelation.findMany({
      where: { fromId: id },
      select: { to: { select: LIST_SELECT } },
      take: limit,
    });
    const out = explicit.map((r) => r.to);

    if (out.length < limit && item.categoryId) {
      const fill = await this.prisma.contentItem.findMany({
        where: {
          status: ContentStatus.PUBLISHED,
          categoryId: item.categoryId,
          id: { notIn: [id, ...out.map((o) => o.id)] },
        },
        orderBy: { publishedAt: 'desc' },
        take: limit - out.length,
        select: LIST_SELECT,
      });
      out.push(...fill);
    }
    return out.map((i) => ({ ...i, tags: i.tags.map((t: any) => t.tag) }));
  }

  /** Materiały powstałe z danego wątku — druga strona FORUM → WIEDZA. */
  async derivedFromPost(postId: number) {
    const items = await this.prisma.contentItem.findMany({
      where: { sourcePostId: postId, status: ContentStatus.PUBLISHED },
      select: LIST_SELECT,
      orderBy: { publishedAt: 'desc' },
    });
    return items.map((i) => ({ ...i, tags: i.tags.map((t) => t.tag) }));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ZAPIS
  // ═══════════════════════════════════════════════════════════════════

  async create(userId: number, role: string, data: any) {
    if (!data.title?.trim()) throw new BadRequestException('Tytuł jest wymagany');
    if (!data.type) throw new BadRequestException('Typ materiału jest wymagany');
    this.assertCanCreate(role, data.type);

    const authorId = await this.resolveAuthor(userId, role, data.authorId);
    const slug = await this.uniqueSlug(data.type, data.slug || data.title);

    const item = await this.prisma.contentItem.create({
      data: {
        type: data.type,
        status: ContentStatus.DRAFT,
        title: sanitizeText(data.title.trim()) ?? '',
        slug,
        excerpt: sanitizeText(data.excerpt),
        body: sanitizeBody(data.body),
        coverUrl: data.coverUrl ?? null,
        authorId,
        categoryId: data.categoryId ?? null,
        sourcePostId: data.sourcePostId ?? null,
        readingTime: this.readingTime(data.body ?? ''),
        sources: data.sources ?? undefined,
        ...this.seoFields(data),
      },
    });

    if (Array.isArray(data.tagIds)) await this.setTags(item.id, data.tagIds);
    return item;
  }

  async update(id: number, userId: number, role: string, data: any) {
    const item = await this.requireEditable(id, userId, role);

    /*
     * Rewizja powstaje PRZED nadpisaniem i tylko dla treści, która już
     * gdzieś jest — szkic nie ma czego archiwizować.
     *
     * Warunek brzmiał `data.body && …`, więc WYCZYSZCZENIE treści nie
     * tworzyło rewizji: pusty łańcuch jest fałszywy. Dokładnie ten
     * przypadek trzeba zapisać najbardziej — to jedyny, po którym nie
     * zostaje nic. Teraz liczy się każda zmiana, łącznie z opróżnieniem.
     */
    if (
      item.status === ContentStatus.PUBLISHED &&
      data.body !== undefined &&
      data.body !== item.body &&
      item.body
    ) {
      await this.prisma.contentRevision.create({
        data: {
          contentItemId: id,
          editorId: userId,
          title: item.title,
          body: item.body,
          summary: data.revisionSummary ?? null,
        },
      });
    }

    /*
     * Zmiana rodzaju materiału.
     *
     * `type` w ogóle nie trafiał do zapisu — przestawienie wiki na how-to
     * w formularzu było po cichu ignorowane i wpis wracał jako wiki.
     *
     * Rodzaj rządzi trzema rzeczami naraz: adresem publicznym
     * (/wiki/x → /how-to/x), przestrzenią unikalności ślimaka (para
     * type+slug) i tym, komu wolno go założyć. Dlatego przeliczamy ślimak
     * w DOCELOWYM rodzaju, nawet gdy sam ślimak się nie zmienia: pod
     * nowym typem może już istnieć wpis o tej samej nazwie.
     */
    const nextType: ContentType =
      data.type && data.type !== item.type ? (data.type as ContentType) : item.type;

    if (nextType !== item.type) this.assertCanCreate(role, nextType);

    const nextSlug =
      data.slug
        ? await this.uniqueSlug(nextType, data.slug, id)
        : nextType !== item.type
          ? await this.uniqueSlug(nextType, item.slug, id)
          : undefined;

    const updated = await this.prisma.contentItem.update({
      where: { id },
      data: {
        ...(nextType !== item.type && { type: nextType }),
        ...(data.title && { title: sanitizeText(data.title.trim()) ?? '' }),
        ...(nextSlug && { slug: nextSlug }),
        ...(data.excerpt !== undefined && { excerpt: sanitizeText(data.excerpt) }),
        ...(data.body !== undefined && {
          body: sanitizeBody(data.body),
          readingTime: this.readingTime(data.body),
        }),
        ...(data.coverUrl !== undefined && { coverUrl: data.coverUrl }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.sourcePostId !== undefined && { sourcePostId: data.sourcePostId }),
        ...(data.sources !== undefined && { sources: data.sources }),
        ...this.seoFields(data),
      },
    });

    if (Array.isArray(data.tagIds)) await this.setTags(id, data.tagIds);

    /*
     * Podmieniona okładka zwalnia poprzedni plik.
     *
     * Bez tego każde wgranie nowej grafiki do tego samego materiału
     * zostawiało starą na dysku i w bibliotece — na zawsze, bo nic już
     * na nią nie wskazywało. Po kilku poprawkach jednego newsa katalog
     * pełen jest plików, których nikt nie umie przypisać.
     *
     * Zwolnienie sprawdza wpierw, czy obrazek nie siedzi w treści innego
     * materiału albo we wpisie na forum; jeśli siedzi, zostaje.
     */
    if (data.coverUrl !== undefined && item.coverUrl && item.coverUrl !== updated.coverUrl) {
      await this.media.releaseIfUnused(item.coverUrl).catch(() => undefined);
    }

    /*
     * Odświeżamy STARY i NOWY adres.
     *
     * Materiał przenosi zmiana ślimaka ORAZ zmiana rodzaju — /wiki/x
     * i /how-to/x to dwie różne strony. Bez unieważnienia poprzedniej
     * pod starym adresem zostawała nieaktualna kopia, którą wyszukiwarka
     * i czytelnik nadal widzą.
     */
    await this.invalidate({ type: updated.type, slug: updated.slug });
    if (item.slug !== updated.slug || item.type !== updated.type) {
      await this.invalidate({ type: item.type, slug: item.slug });
    }
    return updated;
  }

  async remove(id: number, userId: number, role: string) {
    const item = await this.requireEditable(id, userId, role);
    await this.prisma.contentItem.delete({ where: { id } });
    // Okładka skasowanego materiału też nie ma już właściciela.
    if (item.coverUrl) await this.media.releaseIfUnused(item.coverUrl).catch(() => undefined);
    await this.invalidate({ type: item.type, slug: item.slug });
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  OBIEG REDAKCYJNY
  //
  //  `status` mówi, gdzie materiał jest teraz. `EditorialReview` mówi,
  //  jak tam trafił. To dwie różne rzeczy i żadna nie zastępuje drugiej.
  // ═══════════════════════════════════════════════════════════════════

  /** Autor zgłasza własny materiał do akceptacji. */
  async submit(id: number, userId: number, role: string, note?: string) {
    const item = await this.requireEditable(id, userId, role);
    if (item.status !== ContentStatus.DRAFT) {
      throw new BadRequestException('Do akceptacji zgłasza się szkic');
    }
    return this.transition(id, userId, item.status, ContentStatus.REVIEW, note);
  }

  /** Redakcja odsyła do poprawy. Powód jest obowiązkowy — odrzucenie bez
   *  uzasadnienia zostawia autora bez informacji, co poprawić. */
  async reject(id: number, userId: number, note: string) {
    if (!note?.trim()) throw new BadRequestException('Podaj powód odesłania');
    const item = await this.requireExists(id);
    if (item.status !== ContentStatus.REVIEW) {
      throw new BadRequestException('Odesłać można tylko materiał w akceptacji');
    }
    return this.transition(id, userId, item.status, ContentStatus.DRAFT, note);
  }

  /**
   * Publikacja.
   *
   * Redaktor i administrator publikują z dowolnego stanu — brief mówi
   * wprost, że nie każdy materiał musi przejść przez akceptację.
   * Data publikacji ustawia się raz: ponowne opublikowanie po wycofaniu
   * nie udaje, że materiał jest nowy.
   */
  async publish(id: number, userId: number, note?: string) {
    const item = await this.requireExists(id);
    if (item.status === ContentStatus.PUBLISHED) {
      throw new BadRequestException('Materiał jest już opublikowany');
    }
    await this.prisma.contentItem.update({
      where: { id },
      data: {
        status: ContentStatus.PUBLISHED,
        publishedAt: item.publishedAt ?? new Date(),
      },
    });
    await this.log(id, userId, item.status, ContentStatus.PUBLISHED, note);
    await this.invalidate({ type: item.type, slug: item.slug });
    return { id, status: ContentStatus.PUBLISHED };
  }

  /** Wycofanie do szkicu. */
  async unpublish(id: number, userId: number, note?: string) {
    const item = await this.requireExists(id);
    if (item.status !== ContentStatus.PUBLISHED) {
      throw new BadRequestException('Wycofać można tylko opublikowany materiał');
    }
    return this.transition(id, userId, item.status, ContentStatus.DRAFT, note);
  }

  /** Archiwizacja — materiał znika z serwisu, ale zostaje w bazie i historii. */
  async archive(id: number, userId: number, note?: string) {
    const item = await this.requireExists(id);
    return this.transition(id, userId, item.status, ContentStatus.ARCHIVED, note);
  }

  /** Historia decyzji redakcyjnych. */
  async history(id: number) {
    return this.prisma.editorialReview.findMany({
      where: { contentItemId: id },
      include: { reviewer: { select: { id: true, username: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Historia zmian treści. */
  async revisions(id: number) {
    return this.prisma.contentRevision.findMany({
      where: { contentItemId: id },
      select: {
        id: true, title: true, summary: true, createdAt: true,
        editor: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revision(id: number, revisionId: number) {
    const rev = await this.prisma.contentRevision.findFirst({
      where: { id: revisionId, contentItemId: id },
    });
    if (!rev) throw new NotFoundException('Rewizja nie istnieje');
    return rev;
  }

  /** Liczby na pulpit Studia. */
  async studioStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [drafts, review, publishedToday, byType] = await Promise.all([
      this.prisma.contentItem.count({ where: { status: ContentStatus.DRAFT } }),
      this.prisma.contentItem.count({ where: { status: ContentStatus.REVIEW } }),
      this.prisma.contentItem.count({
        where: { status: ContentStatus.PUBLISHED, publishedAt: { gte: startOfDay } },
      }),
      this.prisma.contentItem.groupBy({
        by: ['type'],
        where: { status: ContentStatus.PUBLISHED },
        _count: true,
      }),
    ]);

    const counts = Object.fromEntries(byType.map((r) => [r.type, r._count]));
    return {
      drafts,
      review,
      publishedToday,
      news: counts.NEWS ?? 0,
      articles: counts.ARTICLE ?? 0,
      howto: counts.HOWTO ?? 0,
      wiki: counts.WIKI ?? 0,
    };
  }

  /** Ostatnie decyzje redakcyjne — druga połowa pulpitu. */
  async recentActivity(limit = 10) {
    return this.prisma.editorialReview.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, username: true, displayName: true } },
        contentItem: { select: { id: true, type: true, slug: true, title: true } },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  POMOCNICZE
  // ═══════════════════════════════════════════════════════════════════

  private async transition(
    id: number, userId: number,
    from: ContentStatus, to: ContentStatus, note?: string,
  ) {
    const updated = await this.prisma.contentItem.update({ where: { id }, data: { status: to } });
    await this.log(id, userId, from, to, note);
    await this.invalidate({ type: updated.type, slug: updated.slug });
    return { id, status: to };
  }

  private async log(
    contentItemId: number, reviewerId: number,
    fromStatus: ContentStatus, toStatus: ContentStatus, note?: string,
  ) {
    // Zapis historii nie może wywrócić operacji, która się powiodła.
    await this.prisma.editorialReview
      .create({ data: { contentItemId, reviewerId, fromStatus, toStatus, note: note ?? null } })
      .catch(() => undefined);
  }

  private async requireExists(id: number) {
    const item = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Materiał nie istnieje');
    return item;
  }

  /**
   * Autor edytuje wyłącznie swoje. Redaktor i administrator — wszystko.
   * To cała reguła; nie ma tu miejsca na listę uprawnień per pole.
   */
  private async requireEditable(id: number, userId: number, role: string) {
    const item = await this.requireExists(id);
    if (canReview(role)) return item;

    const author = await this.prisma.author.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!author || item.authorId !== author.id) {
      throw new ForbiddenException('Można edytować wyłącznie własne materiały');
    }

    /*
     * Materiał leżący w akceptacji jest zamrożony dla autora.
     *
     * Bez tego tekst zmieniałby się pod recenzentem: moderator czytałby
     * jedną wersję, a zatwierdzał inną. Autor odzyskuje materiał, gdy
     * moderacja odeśle go do poprawy.
     */
    if (item.status === ContentStatus.REVIEW) {
      throw new ForbiddenException(
        'Materiał czeka na akceptację. Poczekaj na decyzję moderacji albo poproś o odesłanie do poprawy.',
      );
    }
    /*
     * Opublikowane hasło poprawia autor lub redakcja, nie przypadkowy
     * czytelnik — każda zmiana ląduje w rewizjach, więc autorowi ufamy.
     * Zwykłe konto po publikacji zgłasza poprawkę przez komentarz.
     */
    if (item.status === ContentStatus.PUBLISHED && role === 'USER') {
      throw new ForbiddenException(
        'Opublikowane hasło poprawia redakcja. Napisz, co zmienić, w komentarzu pod hasłem.',
      );
    }
    return item;
  }

  /**
   * Czy ta rola może założyć materiał tego typu.
   *
   * Odmowa mówi wprost, co wolno — komunikat „brak uprawnień" zostawia
   * użytkownika z pytaniem, czego właściwie próbował.
   */
  private assertCanCreate(role: string, type: ContentType) {
    const allowed = TYPES_BY_ROLE[role] ?? [];
    if (!allowed.includes(type)) {
      throw new ForbiddenException(
        allowed.length === 0
          ? 'To konto nie może zakładać materiałów.'
          : `Twoja rola pozwala zakładać: ${allowed.join(', ')}.`,
      );
    }
  }

  /**
   * Profil autora zalogowanego użytkownika — albo `null`, jeśli jeszcze
   * nic nie napisał. Studio używa tego do zawężenia listy do własnych
   * materiałów.
   */
  /**
   * Pełny materiał do edycji — RAZEM Z TREŚCIĄ.
   *
   * Studio pobierało wcześniej edytowany materiał z listy, a `LIST_SELECT`
   * świadomie pomija `body` (dwadzieścia artykułów z pełnym tekstem to
   * kilkaset kilobajtów na liście, z której widać trzy zdania). Edytor
   * otwierał się więc pusty, a zapis nadpisywał treść pustką — to była
   * cicha utrata tekstu, nie tylko niewygoda.
   *
   * Dostęp jak przy edycji, ale bez zamrożeń: autor MUSI móc przeczytać
   * własny materiał leżący w akceptacji, choć nie wolno mu go wtedy zmienić.
   */
  async forEditing(id: number, userId: number, role: string) {
    const item = await this.prisma.contentItem.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, slug: true, name: true } },
        category: { select: { id: true, slug: true, name: true } },
        tags: { select: { tag: { select: { id: true, slug: true, name: true } } } },
      },
    });
    if (!item) throw new NotFoundException('Nie znaleziono materiału');

    if (!canReview(role)) {
      const author = await this.prisma.author.findUnique({
        where: { userId }, select: { id: true },
      });
      if (!author || item.authorId !== author.id) {
        throw new ForbiddenException('Można otwierać wyłącznie własne materiały');
      }
    }

    return {
      ...item,
      // Front dostaje jasną odpowiedź, czy pola mają być zablokowane,
      // zamiast wyprowadzać to sobie ze statusu i roli osobno.
      canEdit: canReview(role) || item.status === ContentStatus.DRAFT,
    };
  }

  async authorIdOf(userId: number): Promise<number | null> {
    const a = await this.prisma.author.findUnique({
      where: { userId }, select: { id: true },
    });
    return a?.id ?? null;
  }

  /**
   * Kto jest podpisany pod materiałem.
   *
   * Autor pisze pod sobą. Redakcja może podpisać kogokolwiek — bo autorem
   * bywa osoba bez konta, a wtedy `Author` istnieje bez `User`.
   */
  private async resolveAuthor(userId: number, role: string, requested?: number) {
    if (requested && (role === 'ADMIN' || role === 'EDITOR')) return requested;

    const mine = await this.prisma.author.findUnique({
      where: { userId }, select: { id: true },
    });
    if (mine) return mine.id;

    // Pierwszy materiał użytkownika zakłada mu profil autora. Bez tego
    // każdy nowy autor wymagałby ręcznego kroku administratora.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, displayName: true, avatarUrl: true },
    });
    const created = await this.prisma.author.create({
      data: {
        userId,
        name: user?.displayName || user?.username || `Autor ${userId}`,
        slug: await this.uniqueAuthorSlug(user?.username ?? `autor-${userId}`),
        avatarUrl: user?.avatarUrl ?? null,
      },
      select: { id: true },
    });
    return created.id;
  }

  private slugify(text: string) {
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ł/g, 'l')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'material';
  }

  /** Adres unikalny w obrębie typu; kolizje rozstrzyga przyrostek. */
  private async uniqueSlug(type: ContentType, source: string, excludeId?: number) {
    const base = this.slugify(source);
    let slug = base;
    for (let n = 2; n < 100; n++) {
      const clash = await this.prisma.contentItem.findFirst({
        where: { type, slug, ...(excludeId && { id: { not: excludeId } }) },
        select: { id: true },
      });
      if (!clash) return slug;
      slug = `${base}-${n}`;
    }
    return `${base}-${Date.now()}`;
  }

  private async uniqueAuthorSlug(source: string) {
    const base = this.slugify(source);
    let slug = base;
    for (let n = 2; n < 100; n++) {
      const clash = await this.prisma.author.findUnique({ where: { slug }, select: { id: true } });
      if (!clash) return slug;
      slug = `${base}-${n}`;
    }
    return `${base}-${Date.now()}`;
  }

  private readingTime(body: string) {
    const words = body.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  }

  /* Pola SEO trafiają do <head> — czysty tekst, bez wyjątków. */
  private seoFields(data: any) {
    return {
      ...(data.metaTitle !== undefined && { metaTitle: sanitizeText(data.metaTitle) }),
      ...(data.metaDescription !== undefined && { metaDescription: sanitizeText(data.metaDescription) }),
      ...(data.canonicalUrl !== undefined && { canonicalUrl: sanitizeText(data.canonicalUrl) }),
      ...(data.ogTitle !== undefined && { ogTitle: sanitizeText(data.ogTitle) }),
      ...(data.ogDescription !== undefined && { ogDescription: sanitizeText(data.ogDescription) }),
      ...(data.ogImage !== undefined && { ogImage: sanitizeText(data.ogImage) }),
    };
  }

  private async setTags(contentItemId: number, tagIds: number[]) {
    await this.prisma.contentItemTag.deleteMany({ where: { contentItemId } });
    if (tagIds.length === 0) return;
    await this.prisma.contentItemTag.createMany({
      data: tagIds.map((tagId) => ({ contentItemId, tagId })),
      skipDuplicates: true,
    });
  }

  /**
   * Sprzątanie po zapisie: Redis ORAZ pamięć podręczna stron Next.js.
   *
   * Sam Redis nie wystarczał. Strony materiałów renderują się z cache
   * odświeżanego co 300 sekund, więc po zapisie przez pięć minut widać
   * było starą treść i starą kategorię — z perspektywy redakcji zapis
   * po prostu nie działał.
   *
   * `slug` i `type` podajemy, gdy znamy konkretny materiał; listy
   * odświeżamy zawsze, bo zmiana kategorii przenosi wpis między nimi.
   */
  private async invalidate(item?: { type: ContentType; slug: string }) {
    await this.redis.delPattern('content:list:*').catch(() => undefined);

    const paths = ['/', '/discover', '/news', '/articles', '/how-to', '/wiki'];
    if (item) paths.push(`/${PATH_BY_TYPE[item.type]}/${item.slug}`);

    /*
     * Znaczniki obok ścieżek.
     *
     * Ścieżka czyści pamięć strony, znacznik — pamięć ODPOWIEDZI z API.
     * Bez tego drugiego regeneracja strony sięgała po zapisaną odpowiedź
     * sprzed zmiany i odtwarzała nieaktualną wersję: materiał przeniesiony
     * z /wiki na /how-to nadal działał pod starym adresem.
     */
    const tags = ['content', ...(item ? [`content:${item.slug}`] : [])];
    await this.revalidateFront(paths, tags);
  }

  /**
   * Prośba do frontu o odświeżenie stron.
   *
   * Cicha przy każdej awarii: nieudane odświeżenie cache nie może wywrócić
   * zapisu, który już się powiódł. Najgorsze, co się stanie, to strona
   * nieaktualna przez pięć minut — czyli stan sprzed tej funkcji.
   */
  private async revalidateFront(paths: string[], tags: string[] = []) {
    const base = process.env.FRONTEND_INTERNAL_URL;
    const secret = process.env.REVALIDATE_SECRET;
    if (!base || !secret) return;

    try {
      await fetch(`${base}/api/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
        body: JSON.stringify({ paths, tags }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      /* front nie odpowiada — cache wygaśnie sam */
    }
  }
}
