import {
  Injectable, Logger, BadRequestException, NotFoundException, OnModuleInit,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { PremiumService } from '../premium/premium.service';

export type OkresPro = 'month' | 'year';

/**
 * Płatności za UNDERNET PRO.
 *
 * Zasada, na której stoi cały ten moduł: to Stripe jest źródłem prawdy
 * o opłacie, a nie powrót użytkownika na stronę „dziękujemy". Powrót
 * można sfałszować, wpisując adres z ręki; podpisanego webhooka nie.
 * Dlatego PRO nadaje WYŁĄCZNIE `obsluzZdarzenie`, a strona powrotu
 * jedynie mówi „czekamy na potwierdzenie".
 */
@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private premium: PremiumService,
  ) {}

  onModuleInit() {
    const klucz = process.env.STRIPE_SECRET_KEY;
    if (!klucz) {
      // Brak klucza to poprawny stan wdrożenia bez płatności — moduł ma
      // wtedy milczeć, a nie wywracać całą aplikację przy starcie.
      this.logger.warn('STRIPE_SECRET_KEY nie ustawiony — płatności wyłączone.');
      return;
    }
    this.stripe = new Stripe(klucz);
    this.logger.log(`Stripe gotowy (${klucz.startsWith('sk_test') ? 'TRYB TESTOWY' : 'tryb produkcyjny'}).`);
  }

  get wlaczone(): boolean {
    return Boolean(this.stripe && this.ceny().month);
  }

  private ceny(): Record<OkresPro, string | undefined> {
    return {
      month: process.env.STRIPE_PRICE_PRO_MONTH,
      year: process.env.STRIPE_PRICE_PRO_YEAR,
    };
  }

  private klient(): Stripe {
    if (!this.stripe) throw new BadRequestException('Płatności nie są skonfigurowane.');
    return this.stripe;
  }

  /** Cennik dla strony — kwoty bierzemy ze Stripe'a, nie z kodu. */
  async cennik() {
    if (!this.wlaczone || !(await this.premium.proWidoczne())) {
      return { wlaczone: false, plany: [] };
    }
    const ceny = this.ceny();
    const plany: any[] = [];

    for (const okres of ['month', 'year'] as OkresPro[]) {
      const id = ceny[okres];
      if (!id) continue;
      try {
        const p = await this.klient().prices.retrieve(id);
        plany.push({
          okres,
          priceId: p.id,
          kwota: (p.unit_amount ?? 0) / 100,
          waluta: (p.currency ?? 'pln').toUpperCase(),
        });
      } catch (e: any) {
        this.logger.error(`Cena ${id}: ${e?.message}`);
      }
    }
    return { wlaczone: plany.length > 0, plany };
  }

  /**
   * Sesja płatności.
   *
   * `client_reference_id` niesie nasz numer konta przez cały przelot do
   * Stripe'a i z powrotem w webhooku — bez niego po zapłacie nie dałoby
   * się orzec, komu właściwie nadać PRO.
   */
  async utworzSesje(userId: number, okres: OkresPro) {
    /*
     * Schowane PRO nie znaczy „ukryty przycisk, ale zapłacić nadal można".
     * Ktoś z zapamiętanym adresem /pro albo starą kartą w przeglądarce
     * trafiłby na czynną kasę do oferty, której nie ogłaszamy — i wtedy
     * mielibyśmy jego pieniądze za coś, czego nie sprzedajemy.
     */
    if (!(await this.premium.proWidoczne())) {
      throw new BadRequestException('UNDERNET PRO jest chwilowo niedostępne.');
    }

    const priceId = this.ceny()[okres];
    if (!priceId) throw new BadRequestException('Ten plan nie jest dostępny.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, stripeCustomerId: true },
    });
    if (!user) throw new NotFoundException('Nie ma takiego konta');

    const base = process.env.PUBLIC_URL || 'https://undernet.one';

    const sesja = await this.klient().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: String(user.id),
      ...(user.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user.email }),
      success_url: `${base}/pro?platnosc=ok`,
      cancel_url: `${base}/pro?platnosc=anulowana`,
      allow_promotion_codes: true,
      locale: 'pl',
    });

    return { url: sesja.url };
  }

  /**
   * Panel klienta Stripe.
   *
   * Rezygnacja, zmiana karty i faktury zostają po stronie Stripe'a
   * celowo: przepisywanie tego u siebie znaczyłoby przechowywanie
   * danych karty, a tego nie chcemy dotykać.
   */
  async panelKlienta(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      throw new BadRequestException('To konto nie ma jeszcze żadnej płatności.');
    }
    const base = process.env.PUBLIC_URL || 'https://undernet.one';
    const sesja = await this.klient().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${base}/pro`,
    });
    return { url: sesja.url };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  WEBHOOK
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Sprawdzenie podpisu.
   *
   * Bez tego trasa webhooka byłaby publicznym przyciskiem „daj mi PRO":
   * wystarczyłoby wysłać na nią własnoręcznie sklecony JSON.
   */
  zweryfikuj(surowe: Buffer, podpis: string): Stripe.Event {
    const sekret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sekret) throw new BadRequestException('STRIPE_WEBHOOK_SECRET nie ustawiony.');
    try {
      return this.klient().webhooks.constructEvent(surowe, podpis, sekret);
    } catch (e: any) {
      throw new BadRequestException(`Podpis się nie zgadza: ${e?.message}`);
    }
  }

  async obsluzZdarzenie(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = Number(s.client_reference_id);
        if (!userId || !s.subscription) break;

        const sub = await this.klient().subscriptions.retrieve(String(s.subscription));
        await this.zapiszSubskrypcje(userId, sub, String(s.customer));
        this.logger.log(`PRO nadane kontu #${userId}`);
        break;
      }

      // Odnowienie i wygaśnięcie przychodzą jako zmiana subskrypcji;
      // konto znajdujemy po identyfikatorze klienta, bo tu nie ma już
      // naszego `client_reference_id`.
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const user = await this.prisma.user.findFirst({
          where: { stripeCustomerId: String(sub.customer) },
          select: { id: true },
        });
        if (!user) break;
        await this.zapiszSubskrypcje(user.id, sub, String(sub.customer));
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const user = await this.prisma.user.findFirst({
          where: { stripeCustomerId: String(inv.customer) },
          select: { id: true, username: true },
        });
        if (!user) break;
        // NIE odbieramy tu PRO. Nieudane obciążenie bywa chwilowe
        // (limit na karcie, ponowna próba banku), a Stripe i tak przyśle
        // `subscription.updated`, gdy naprawdę się skończy.
        this.logger.warn(`Nieudana płatność: ${user.username} (#${user.id})`);
        break;
      }

      default:
        break;
    }
  }

  /** Jedno miejsce, w którym stan ze Stripe'a ląduje na koncie. */
  private async zapiszSubskrypcje(userId: number, sub: Stripe.Subscription, customerId: string) {
    const aktywna = sub.status === 'active' || sub.status === 'trialing';

    /*
     * Koniec opłaconego okresu.
     *
     * W nowszych wersjach API Stripe przeniósł `current_period_end` z samej
     * subskrypcji na jej POZYCJĘ. Czytany po staremu wychodził pusty, a puste
     * `proUntil` u nas znaczy „bezterminowo" — czyli nieopłacone konto
     * dostawało PRO bez końca. Bierzemy pozycję, ze starym polem jako zapasem.
     */
    const koniec =
      (sub.items?.data?.[0] as any)?.current_period_end ??
      (sub as any).current_period_end ??
      null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isPro: aktywna,
        /*
         * `isPro` idzie za stanem ze Stripe'a, a `proUntil` zostaje jako
         * data końca opłaconego okresu.
         *
         * Rezygnacja przez panel klienta NIE odcina od razu: Stripe trzyma
         * wtedy status `active` do końca opłaconego okresu i dopiero potem
         * przysyła `deleted`. Natychmiastowe odcięcie zdarza się tylko przy
         * anulowaniu z ręki (np. przy zwrocie) — i wtedy jest zamierzone.
         */
        proUntil: koniec ? new Date(koniec * 1000) : null,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripeStatus: sub.status,
      },
    });
  }

  /** Stan przedpłaty dla zalogowanego — do strony /pro. */
  async mojStan(userId: number) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPro: true, proUntil: true, stripeStatus: true, stripeCustomerId: true },
    });
    return {
      isPro: Boolean(u?.isPro) && (!u?.proUntil || u.proUntil > new Date()),
      proUntil: u?.proUntil ?? null,
      status: u?.stripeStatus ?? null,
      maPlatnosci: Boolean(u?.stripeCustomerId),
    };
  }
}
