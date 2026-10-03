import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { PremiumService } from '../premium/premium.service';
import { OptionalJwtGuard } from '../auth/jwt-auth.guard';

@Controller('search')
export class SearchController {
  constructor(
    private searchService: SearchService,
    private premium: PremiumService,
  ) {}

  /**
   * Wyszukiwanie, opcjonalnie zawężone.
   *
   * Samo `q` działa dla wszystkich i tak zostaje — wyszukiwarka bez
   * logowania to podstawa serwisu, nie dodatek.
   *
   * Filtry podlegają przełącznikowi `advanced-search` w panelu. Gdy jest
   * wyłączony, działają dla wszystkich; gdy włączony — tylko dla PRO.
   * Odpowiedź MÓWI, czy filtry zadziałały (`filtryZastosowane`), zamiast
   * po cichu je zignorować: wynik bez zawężenia wygląda identycznie jak
   * zawężenie, które nic nie odsiało, i nie dałoby się tego odróżnić.
   */
  @Get()
  @UseGuards(OptionalJwtGuard)
  async search(
    @Query('q') q: string,
    @Query('limit') limit = 10,
    @Query('typ') typ: string | undefined,
    @Query('kategoria') kategoria: string | undefined,
    @Query('autor') autor: string | undefined,
    @Query('spolecznosc') spolecznosc: string | undefined,
    @Query('od') od: string | undefined,
    @Query('do') doKiedy: string | undefined,
    @Query('wTresci') wTresci: string | undefined,
    @Req() req: any,
  ) {
    const chcianeFiltry = { typ, kategoria, autor, spolecznosc, od, do: doKiedy, wTresci: wTresci === '1' };
    const cokolwiekPodano = Object.entries(chcianeFiltry)
      .some(([k, v]) => (k === 'wTresci' ? v === true : Boolean(v)));

    const wolno = await this.premium.canUse(req.user?.userId ?? null, 'advanced-search');
    const filtry = wolno ? chcianeFiltry : {};

    const wyniki = await this.searchService.search(
      q,
      Math.min(20, Math.max(1, Number(limit))),
      filtry,
    );

    return {
      ...wyniki,
      filtryDostepne: wolno,
      filtryZastosowane: wolno && cokolwiekPodano,
    };
  }
}
