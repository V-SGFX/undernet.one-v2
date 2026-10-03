import {
  Injectable, ForbiddenException, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PremiumService } from '../premium/premium.service';

const MAX_DLUGOSC = 5000;

/**
 * Prywatne notatki.
 *
 * Notatka jest widoczna WYŁĄCZNIE dla autora i nie ma trybu publicznego —
 * to nie komentarz. Rozróżnienie jest istotne: tekst pisany „dla siebie"
 * brzmi zupełnie inaczej niż wypowiedź pisana dla innych, a przełącznik
 * widoczności zamieniłby jedno w drugie bez wiedzy piszącego.
 */
@Injectable()
export class NotesService {
  constructor(
    private prisma: PrismaService,
    private premium: PremiumService,
  ) {}

  private async wymagajDostepu(userId: number) {
    if (!(await this.premium.canUse(userId, 'private-notes'))) {
      throw new ForbiddenException('Prywatne notatki są częścią UNDERNET PRO.');
    }
  }

  private cel(t: { postId?: number; contentItemId?: number }) {
    if (Boolean(t.postId) === Boolean(t.contentItemId)) {
      throw new BadRequestException('Podaj dokładnie jedno: postId albo contentItemId');
    }
    return t.postId ? { postId: t.postId } : { contentItemId: t.contentItemId };
  }

  /** Notatka do konkretnej rzeczy — albo `null`, gdy jeszcze jej nie ma. */
  async forTarget(userId: number, t: { postId?: number; contentItemId?: number }) {
    return this.prisma.privateNote.findFirst({ where: { userId, ...this.cel(t) } });
  }

  /**
   * Zapis notatki.
   *
   * Jedna metoda na utworzenie i zmianę: z punktu widzenia piszącego to
   * jedna czynność („zapisz, co myślę"), a nie dwie. Pusta treść kasuje —
   * wyczyszczenie pola i zapisanie znaczy „już tego nie potrzebuję".
   */
  async save(userId: number, t: { postId?: number; contentItemId?: number }, body: string) {
    await this.wymagajDostepu(userId);
    const cel = this.cel(t);
    const tresc = (body ?? '').trim();

    const istniejaca = await this.prisma.privateNote.findFirst({ where: { userId, ...cel } });

    if (!tresc) {
      if (istniejaca) await this.prisma.privateNote.delete({ where: { id: istniejaca.id } });
      return { usunieta: true };
    }
    if (tresc.length > MAX_DLUGOSC) {
      throw new BadRequestException(`Notatka może mieć najwyżej ${MAX_DLUGOSC} znaków.`);
    }

    if (istniejaca) {
      return this.prisma.privateNote.update({ where: { id: istniejaca.id }, data: { body: tresc } });
    }
    return this.prisma.privateNote.create({
      data: { userId, body: tresc, postId: cel.postId ?? null, contentItemId: cel.contentItemId ?? null },
    });
  }

  /**
   * Wszystkie notatki — do przeglądu w profilu.
   *
   * BEZ sprawdzania PRO: kto stracił abonament, ma prawo odczytać i wynieść
   * to, co napisał. Odcięcie własnych zapisków to kara, nie ograniczenie.
   */
  async list(userId: number) {
    return this.prisma.privateNote.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        post: { select: { id: true, title: true } },
        contentItem: { select: { id: true, type: true, slug: true, title: true } },
      },
    });
  }

  async remove(userId: number, id: number) {
    const n = await this.prisma.privateNote.findUnique({ where: { id } });
    if (!n || n.userId !== userId) throw new NotFoundException('Nie ma takiej notatki');
    await this.prisma.privateNote.delete({ where: { id } });
    return { ok: true };
  }
}
