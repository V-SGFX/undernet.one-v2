import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { ContentService, canReview } from './content.service';
import { JwtAuthGuard, OptionalJwtGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ContentType, ContentStatus } from '@prisma/client';

/** Adres publiczny → typ w bazie. Jeden słownik zamiast czterech tras. */
const TYPE_BY_PATH: Record<string, ContentType> = {
  news: ContentType.NEWS,
  articles: ContentType.ARTICLE,
  'how-to': ContentType.HOWTO,
  wiki: ContentType.WIKI,
};

/**
 * Treści bazy wiedzy.
 *
 * Jeden kontroler na cztery typy. Cztery osobne oznaczałyby czterokrotne
 * powielenie filtrów, stronicowania i obiegu publikacji — a różnią się
 * wyłącznie wartością `type`.
 *
 * Trasy literalne stoją przed parametrycznymi: `/content/studio/stats`
 * zjadłoby się w `/content/:id`, gdyby kolejność była odwrotna.
 */
@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  // ═══ Publiczne ════════════════════════════════════════════════════

  @Get()
  list(@Query() q: any) {
    return this.content.list({
      type: q.type as ContentType,
      categorySlug: q.category,
      authorSlug: q.author,
      tagSlug: q.tag,
      q: q.q,
      sort: q.sort,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 20,
    });
  }

  /** Materiały powstałe z wątku — baner „na podstawie tej dyskusji". */
  @Get('derived/:postId')
  derived(@Param('postId', ParseIntPipe) postId: number) {
    return this.content.derivedFromPost(postId);
  }

  // ═══ Studio ═══════════════════════════════════════════════════════

  @Get('studio/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR', 'MODERATOR')
  stats() {
    return this.content.studioStats();
  }

  @Get('studio/activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR', 'MODERATOR')
  activity(@Query('limit') limit?: string) {
    return this.content.recentActivity(limit ? Number(limit) : 10);
  }

  /** Lista dla Studia — widzi także szkice i materiały w akceptacji. */
  /**
   * Lista dla Studia — razem ze szkicami.
   *
   * Poza moderacją zawężona do własnych materiałów. Wcześniej strażnik
   * roli wpuszczał tu każdego autora i pokazywał mu CUDZE szkice; przy
   * otwarciu wiki dla zwykłych kont ten sam zapis oznaczałby, że każdy
   * czyta wszystkie niegotowe teksty w serwisie.
   */
  @Get('studio/list')
  @UseGuards(JwtAuthGuard)
  async studioList(@Query() q: any, @Req() req) {
    const mine = canReview(req.user.role)
      ? undefined
      : ((await this.content.authorIdOf(req.user.userId)) ?? -1);

    return this.content.list(
      {
        ...(mine !== undefined && { onlyAuthorId: mine }),
        type: q.type as ContentType,
        status: q.status as ContentStatus,
        categorySlug: q.category,
        authorSlug: q.author,
        tagSlug: q.tag,
        q: q.q,
        page: q.page ? Number(q.page) : 1,
        limit: q.limit ? Number(q.limit) : 20,
      },
      true,
    );
  }

  // ═══ Pojedynczy materiał ══════════════════════════════════════════

  /**
   * Materiał do edycji, z treścią.
   *
   * Pod prefiksem `studio/`, więc stoi PRZED `:type/:slug` — inaczej
   * Express dopasowałby `content/studio/item/10` do trasy publicznej.
   */
  @Get('studio/item/:id')
  @UseGuards(JwtAuthGuard)
  forEditing(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.content.forEditing(id, req.user.userId, req.user.role);
  }

  /**
   * Pod jakim typem leży ten ślimak.
   *
   * Trasa dosłowna, więc MUSI stać przed `:type/:slug` — Express dopasowuje
   * w kolejności deklaracji, a `resolve/cokolwiek` pasuje do `:type/:slug`
   * równie dobrze.
   */
  @Get('resolve/:slug')
  resolve(@Param('slug') slug: string) {
    return this.content.resolveSlug(slug);
  }

  @Get(':id/related')
  related(@Param('id', ParseIntPipe) id: number) {
    return this.content.related(id);
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard)
  history(@Param('id', ParseIntPipe) id: number) {
    return this.content.history(id);
  }

  @Get(':id/revisions')
  revisions(@Param('id', ParseIntPipe) id: number) {
    return this.content.revisions(id);
  }

  @Get(':id/revisions/:revisionId')
  revision(
    @Param('id', ParseIntPipe) id: number,
    @Param('revisionId', ParseIntPipe) revisionId: number,
  ) {
    return this.content.revision(id, revisionId);
  }

  /*
   * Ta trasa MUSI stać po wszystkich `:id/...`.
   *
   * Express dopasowuje w kolejności deklaracji, a `:type/:slug` pasuje
   * do `content/1/history` tak samo dobrze jak `:id/history` — z typem
   * „1" i adresem „history". Efektem był błąd 500 z Prismy zamiast
   * historii redakcyjnej. Ostrzegałem o tym w komentarzu na górze pliku
   * i wpadłem w to i tak, bo kolejność łatwo zepsuć przy dopisywaniu.
   */
  @Get(':type/:slug')
  @UseGuards(OptionalJwtGuard)
  bySlug(@Param('type') type: string, @Param('slug') slug: string, @Req() req) {
    return this.content.bySlug(TYPE_BY_PATH[type] ?? (type.toUpperCase() as ContentType), slug, req.user?.role);
  }


  // ═══ Zapis ════════════════════════════════════════════════════════

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: any, @Req() req) {
    return this.content.create(req.user.userId, req.user.role, body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.content.update(id, req.user.userId, req.user.role, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.content.remove(id, req.user.userId, req.user.role);
  }

  // ═══ Obieg redakcyjny ═════════════════════════════════════════════

  @Patch(':id/submit')
  @UseGuards(JwtAuthGuard)
  submit(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.content.submit(id, req.user.userId, req.user.role, body?.note);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR', 'MODERATOR')
  reject(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.content.reject(id, req.user.userId, body?.note);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR', 'MODERATOR')
  publish(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.content.publish(id, req.user.userId, body?.note);
  }

  @Patch(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR', 'MODERATOR')
  unpublish(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.content.unpublish(id, req.user.userId, body?.note);
  }

  @Patch(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR', 'MODERATOR')
  archive(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.content.archive(id, req.user.userId, body?.note);
  }
}
