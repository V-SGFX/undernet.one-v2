import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, Req, UseGuards,
  UseInterceptors, UploadedFile, ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { UploadsService } from '../uploads/uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const MAX_IMAGE = 8 * 1024 * 1024;

/**
 * Biblioteka grafik materiałów.
 *
 * Strażnik roli zszedł z całego kontrolera na poszczególne trasy: hasło
 * wiki może dziś napisać każdy zalogowany, a materiał bez możliwości
 * wstawienia zrzutu ekranu jest połową materiału. Kasowanie zostaje
 * przy redakcji.
 */
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(
    private media: MediaService,
    private uploads: UploadsService,
  ) {}

  /**
   * Wgranie grafiki: plik na dysk i wpis w bibliotece, jednym żądaniem.
   *
   * Wcześniej trzeba było wywołać `/uploads/:category`, a potem osobno
   * `/media` — więc każdy, kto zapomniał o drugim kroku, zostawiał plik
   * bez `alt` i bez śladu, kto go wgrał.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE } }))
  async upload(@UploadedFile() file: any, @Body() body: any, @Req() req) {
    const url = await this.uploads.processUpload(file, 'content');
    return this.media.register(req.user.userId, {
      url,
      filename: file.originalname ?? url.split('/').pop(),
      mimeType: 'image/webp',
      sizeBytes: file.size,
      alt: body?.alt || undefined,
      caption: body?.caption || undefined,
    });
  }

  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string, @Query('q') q?: string) {
    return this.media.list(page ? Number(page) : 1, limit ? Number(limit) : 40, q);
  }

  /** Wywoływane po wgraniu pliku przez /uploads — rejestruje go w bibliotece. */
  @Post()
  register(@Body() body: any, @Req() req) {
    return this.media.register(req.user.userId, body);
  }

  @Patch(':id')
  describe(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.media.describe(id, body);
  }

  /**
   * Skasowanie z biblioteki.
   *
   * `?plik=1` usuwa też plik z dysku — ale tylko wtedy, gdy nikt go nie
   * używa. Sprawdzenie siedzi w serwisie; bez niego dałoby się wyciąć
   * obrazek ze środka opublikowanego materiału.
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'EDITOR', 'MODERATOR')
  remove(@Param('id', ParseIntPipe) id: number, @Query('plik') plik?: string) {
    return this.media.remove(id, plik === '1');
  }

  /** Gdzie dany plik jest używany — dla przeglądu w panelu. */
  @Get(':id/uzycia')
  async usage(@Param('id', ParseIntPipe) id: number) {
    const asset = await this.media.byId(id);
    return { uzycia: await this.media.usageOf(asset.url) };
  }
}
