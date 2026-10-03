import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PremiumService {
  constructor(private prisma: PrismaService) {}

  /**
   * Pełna lista — dla cennika i dla panelu.
   *
   * BEZ pamięci podręcznej, i to celowo. Osiem wierszy z indeksem to
   * zapytanie, którego nie warto oszczędzać, a przełącznik w panelu pisze
   * prosto do bazy — cache oznaczałby, że zmiana „wymaga PRO" działa
   * dopiero po wygaśnięciu wpisu. Obietnica „zmiana od razu" ma być prawdą.
   */
  async list() {
    return this.prisma.premiumFeature.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { key: true, name: true, description: true, requiresPremium: true, position: true },
    });
  }

  /**
   * Same klucze funkcji, które wymagają PRO.
   *
   * Front pyta o to raz i wie, co ukryć albo oznaczyć kłódką. Zwracamy
   * WYŁĄCZNIE płatne — lista wszystkich funkcji nikomu na stronie nie
   * jest potrzebna poza cennikiem.
   */
  async gatedKeys(): Promise<string[]> {
    const features = await this.list();
    return features.filter((f: any) => f.requiresPremium).map((f: any) => f.key);
  }

  /**
   * Czy dane konto ma dostęp do funkcji.
   *
   * Funkcja niewymagająca PRO jest dostępna dla wszystkich, także dla
   * niezalogowanych — dlatego `userId` bywa pusty i to jest poprawny stan.
   */
  /**
   * Czy konto ma opłacone PRO.
   *
   * Czytane z BAZY, nie z tokenu. Token wystawiony przed zakupem nie wie
   * o nim nic i zostawałby nieaktualny aż do ponownego zalogowania —
   * a właśnie po zakupie użytkownik najmniej chce się przelogowywać.
   */
  async isPro(userId: number | null | undefined): Promise<boolean> {
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPro: true, proUntil: true },
    });
    if (!user?.isPro) return false;
    // Puste `proUntil` = bezterminowo; tak wygląda dostęp nadany ręcznie.
    return !user.proUntil || user.proUntil > new Date();
  }

  /**
   * Czy w ogóle mówimy o UNDERNET PRO.
   *
   * To nie jest bramka dostępu, tylko widoczność samej oferty: przycisk
   * w pasku i strona /pro. Dostępem sterują przełączniki poszczególnych
   * funkcji — przy schowanym PRO wszystko działa dokładnie tak, jak było,
   * tylko nikt nie widzi zaproszenia do zakupu.
   *
   * Brak wiersza w bazie znaczy „pokazuj": tak wygląda instalacja, w której
   * nikt nigdy tego przełącznika nie dotknął, i lepiej, żeby zachowywała
   * się jak przed jego wprowadzeniem.
   */
  async proWidoczne(): Promise<boolean> {
    const wpis = await this.prisma.siteSetting.findUnique({
      where: { key: 'pro-visible' },
      select: { enabled: true },
    });
    return wpis?.enabled ?? true;
  }

  async canUse(userId: number | null, key: string): Promise<boolean> {
    const gated = await this.gatedKeys();
    if (!gated.includes(key)) return true;
    return this.isPro(userId);
  }

}
