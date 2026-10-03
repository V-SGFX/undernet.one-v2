import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Aktywne bloki reklamowe, gotowe do wyszukania po kluczu.
   *
   * Zwracane WSZYSTKIM, także niezalogowanym — reklama, której nikt nie
   * może pobrać, to reklama, której nikt nie zobaczy. Wchodzą wyłącznie
   * wiersze z `isActive`, więc wyłączenie bloku w panelu usuwa go ze
   * strony, a nie tylko chowa w CSS. Pusty `code` nigdy nie trafia na
   * stronę, żeby nie zostawiać kontenera rozpychającego układ.
   *
   * BEZ pamięci podręcznej, i to celowo.
   *
   * Wcześniej odpowiedź leżała w Redisie przez 300 sekund, a panel pisze
   * do bazy BEZPOŚREDNIO, z pominięciem tego serwisu — nie miał go więc
   * jak unieważnić. Skutek: administrator wklejał kod reklamy, zapisywał
   * i przez pięć minut nie widział NICZEGO, dokładnie tak, jakby zapis się
   * nie udał. Osiem wierszy z indeksem nie jest warte tej pomyłki.
   */
  async activeSlots(): Promise<Record<string, string>> {
    const rows = await this.prisma.adSlot.findMany({
      where: { isActive: true, code: { not: null } },
      select: { key: true, code: true },
    });

    const map: Record<string, string> = {};
    for (const row of rows) {
      const code = (row.code ?? '').trim();
      if (code) map[row.key] = code;
    }
    return map;
  }
}
