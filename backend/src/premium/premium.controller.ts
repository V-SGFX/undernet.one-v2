import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PremiumService } from './premium.service';
import { OptionalJwtGuard } from '../auth/jwt-auth.guard';

@Controller('premium')
export class PremiumController {
  constructor(private premium: PremiumService) {}

  /**
   * Stan funkcji PRO dla bieżącego odwiedzającego.
   *
   * Jedno zapytanie zamiast pytania o każdą funkcję z osobna. Publiczne,
   * bo cennik musi się wyświetlić także niezalogowanemu — a `isPro`
   * dotyczy wtedy po prostu nikogo.
   */
  @Get('features')
  @UseGuards(OptionalJwtGuard)
  async features(@Req() req: any) {
    const [features, gated, isPro, proWidoczne] = await Promise.all([
      this.premium.list(),
      this.premium.gatedKeys(),
      // Z bazy, nie z tokenu — patrz PremiumService.isPro().
      this.premium.isPro(req.user?.userId),
      this.premium.proWidoczne(),
    ]);
    return { features, gated, isPro, proWidoczne };
  }
}
