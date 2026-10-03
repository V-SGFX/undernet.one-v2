import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Biblioteka plików.
 *
 * `uploads` zapisuje plik na dysk i zwraca adres — to zostaje bez zmian.
 * Ten serwis prowadzi rejestr: kto wgrał, jakiego rozmiaru, z jakim
 * tekstem alternatywnym. Bez rejestru plik istnieje, ale nie da się go
 * odnaleźć ani powtórnie użyć, a `alt` nie ma gdzie zamieszkać.
 */
@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

  async register(userId: number, data: {
    url: string; filename: string; mimeType: string;
    sizeBytes: number; width?: number; height?: number;
    alt?: string; caption?: string;
  }) {
    return this.prisma.mediaAsset.create({
      data: {
        uploadedById: userId,
        url: data.url,
        filename: data.filename,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        width: data.width ?? null,
        height: data.height ?? null,
        alt: data.alt ?? null,
        caption: data.caption ?? null,
      },
    });
  }

  async list(page = 1, limit = 40, q?: string) {
    const where = q ? { filename: { contains: q, mode: 'insensitive' as const } } : {};
    const [data, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { uploadedBy: { select: { id: true, username: true } } },
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return { data, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  /** Opis obrazka. Jedyne pola, które da się poprawić po wgraniu — reszta
   *  opisuje plik, a plik się nie zmienia. */
  async describe(id: number, data: { alt?: string; caption?: string }) {
    await this.require(id);
    return this.prisma.mediaAsset.update({
      where: { id },
      data: {
        ...(data.alt !== undefined && { alt: data.alt }),
        ...(data.caption !== undefined && { caption: data.caption }),
      },
    });
  }

  async remove(id: number, force = false) {
    const asset = await this.require(id);

    /*
     * Domyślnie kasujemy sam wpis, nie plik — plik może siedzieć
     * w opublikowanym materiale, a jego usunięcie zostawiłoby dziurę.
     * `force` przechodzi też przez plik, ale dopiero po sprawdzeniu,
     * czy naprawdę nikt go nie używa.
     */
    if (force) {
      const uzycia = await this.usageOf(asset.url);
      if (uzycia.length > 0) {
        throw new BadRequestException(
          `Plik jest używany: ${uzycia.join(', ')}. Najpierw odepnij go od tych materiałów.`,
        );
      }
      await this.deleteFile(asset.url);
    }

    await this.prisma.mediaAsset.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Gdzie ten plik jest używany.
   *
   * Trzy miejsca naraz: okładka materiału, treść materiału i treść wpisu
   * na forum. Sprawdzenie tylko okładek kasowałoby obrazki wstawione
   * w środku tekstu, bo formalnie „nie są niczyją okładką".
   */
  async usageOf(url: string): Promise<string[]> {
    if (!url) return [];
    const [okladki, wTresci, wWpisach] = await Promise.all([
      this.prisma.contentItem.findMany({
        where: { coverUrl: url }, select: { id: true, title: true }, take: 5,
      }),
      this.prisma.contentItem.findMany({
        where: { body: { contains: url } }, select: { id: true, title: true }, take: 5,
      }),
      this.prisma.post.count({ where: { content: { contains: url } } }),
    ]);

    const out: string[] = [];
    for (const c of okladki) out.push(`okładka #${c.id} „${c.title.slice(0, 40)}"`);
    for (const c of wTresci) out.push(`treść #${c.id} „${c.title.slice(0, 40)}"`);
    if (wWpisach > 0) out.push(`${wWpisach} wpis(ów) forum`);
    return out;
  }

  /**
   * Zwolnienie pliku, którego już nikt nie używa.
   *
   * Wołane po podmianie okładki: stary obrazek nie ma po niej żadnego
   * właściciela, a bez tego zostawałby na dysku i w bibliotece na zawsze.
   * Wychodzi cicho, gdy plik jest jeszcze gdzieś wstawiony — podmiana
   * okładki nie może kasować obrazka użytego w środku innego tekstu.
   */
  async releaseIfUnused(url: string | null | undefined) {
    if (!url || !url.startsWith('/uploads/')) return { released: false, reason: 'nie nasz plik' };

    const uzycia = await this.usageOf(url);
    if (uzycia.length > 0) return { released: false, reason: 'nadal używany' };

    await this.deleteFile(url);
    await this.prisma.mediaAsset.deleteMany({ where: { url } });
    return { released: true };
  }

  /** Kasowanie z dysku. Ścieżka jest sprawdzana, żeby nie wyjść poza uploads/. */
  private async deleteFile(url: string) {
    const rel = path.normalize(url).replace(/^(\.\.(\/|\\|$))+/, '');
    if (!rel.startsWith('/uploads/') && !rel.startsWith('uploads/')) return;
    const full = path.join(process.cwd(), rel.replace(/^\//, ''));
    await fs.promises.unlink(full).catch(() => undefined);
  }

  /** Pojedynczy plik — używane przez trasę sprawdzającą użycia. */
  async byId(id: number) {
    const m = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Plik nie istnieje');
    return m;
  }

  private async require(id: number) {
    // `url` jest potrzebny do sprawdzenia użyć i skasowania pliku.
    const m = await this.prisma.mediaAsset.findUnique({
      where: { id }, select: { id: true, url: true },
    });
    if (!m) throw new NotFoundException('Plik nie istnieje');
    return m;
  }
}
