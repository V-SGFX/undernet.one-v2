import {
  Controller, Get, Post, Body, Req, Res, Headers, UseGuards, BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { StripeService, type OkresPro } from './stripe.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('stripe')
export class StripeController {
  constructor(private stripe: StripeService) {}

  /** Cennik — jawny, bo strona z cenami musi działać przed zalogowaniem. */
  @Get('cennik')
  cennik() {
    return this.stripe.cennik();
  }

  @Get('moj-stan')
  @UseGuards(JwtAuthGuard)
  mojStan(@Req() req: any) {
    return this.stripe.mojStan(req.user.userId);
  }

  @Post('sesja')
  @UseGuards(JwtAuthGuard)
  sesja(@Body() body: { okres?: OkresPro }, @Req() req: any) {
    return this.stripe.utworzSesje(req.user.userId, body.okres === 'year' ? 'year' : 'month');
  }

  @Post('panel')
  @UseGuards(JwtAuthGuard)
  panel(@Req() req: any) {
    return this.stripe.panelKlienta(req.user.userId);
  }

  /**
   * Webhook ze Stripe'a. Bez strażnika — uwierzytelnia go podpis, nie token.
   *
   * Odpowiadamy 200 nawet wtedy, gdy obsługa zdarzenia się wywali: dla
   * Stripe'a błąd znaczy „przyślij jeszcze raz", a powtarzanie zdarzenia,
   * którego i tak nie umiemy przetworzyć, zapętliłoby kolejkę na dobę.
   * Wyjątkiem jest zły podpis — to jedyny przypadek, w którym odmawiamy.
   */
  @Post('webhook')
  async webhook(
    @Req() req: any,
    @Res() res: Response,
    @Headers('stripe-signature') podpis: string,
  ) {
    if (!podpis) throw new BadRequestException('Brak nagłówka stripe-signature');
    const event = this.stripe.zweryfikuj(req.rawBody, podpis);

    try {
      await this.stripe.obsluzZdarzenie(event);
    } catch (e: any) {
      console.error('[stripe] obsługa zdarzenia', event.type, e?.message);
    }
    res.status(200).json({ received: true });
  }
}
