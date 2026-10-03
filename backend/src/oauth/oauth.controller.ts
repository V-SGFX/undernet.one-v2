import {
  Controller, Get, Delete, Param, Query, Req, Res, UseGuards,
  BadRequestException, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuthService, PROVIDERS, ProviderName } from './oauth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

function isProvider(v: string): v is ProviderName {
  return (PROVIDERS as string[]).includes(v);
}

@Controller('oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private oauth: OAuthService,
    private config: ConfigService,
    private jwt: JwtService,
    private redis: RedisService,
  ) {}

  /**
   * Którzy dostawcy są realnie dostępni.
   *
   * Front pyta o to przed narysowaniem przycisków. Przycisk dostawcy bez
   * kluczy w konfiguracji wygląda jak zepsuta funkcja — dokładnie ten stan
   * odziedziczyliśmy po xdtv i to on był zgłoszonym „zepsutym logowaniem".
   *
   * Trasa MUSI stać przed `:provider`, bo Express dopasowuje w kolejności
   * deklaracji i `providers` wpadłoby w parametr.
   */
  @Get('providers')
  providers() {
    return PROVIDERS.map((p) => ({ provider: p, configured: this.oauth.isConfigured(p) }));
  }

  @Get('platforms/connected')
  @UseGuards(JwtAuthGuard)
  connected(@Req() req) {
    return this.oauth.connected(req.user.userId);
  }

  /** Start logowania: przekierowanie na ekran zgody dostawcy. */
  @Get(':provider')
  async start(
    @Param('provider') provider: string,
    @Query('action') action: string | undefined,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    if (!isProvider(provider)) throw new BadRequestException(`Nieobsługiwany dostawca: ${provider}`);
    if (!this.oauth.isConfigured(provider)) {
      const front = this.config.get('PUBLIC_URL', 'https://undernet.one');
      return res.redirect(`${front}/auth/callback?error=provider_not_configured`);
    }

    // Stan przeciwko CSRF. Trzymamy go po stronie serwera, żeby cudze
    // przekierowanie z podstawionym kodem nie zalogowało nikogo.
    const state = crypto.randomBytes(16).toString('hex');
    await this.redis.set(
      `oauth:state:${state}`,
      JSON.stringify({ action: action === 'link' ? 'link' : 'login', token: token ?? null }),
      600,
    );

    res.redirect(this.oauth.buildAuthorizeUrl(provider, state));
  }

  /** Powrót od dostawcy: kod → profil → sesja. */
  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const front = this.config.get('PUBLIC_URL', 'https://undernet.one');
    const fail = (reason: string) =>
      res.redirect(`${front}/auth/callback?error=${encodeURIComponent(reason)}`);

    if (error || !code) return fail(error || 'no_code');
    if (!isProvider(provider)) return fail('invalid_platform');
    if (!state) return fail('missing_state');

    const raw = await this.redis.get(`oauth:state:${state}`);
    if (!raw) return fail('invalid_state');
    await this.redis.del(`oauth:state:${state}`);

    const stateData = JSON.parse(raw) as { action: string; token: string | null };

    try {
      const profile = await this.oauth.fetchProfile(provider, code);

      if (stateData.action === 'link' && stateData.token) {
        const payload: any = this.jwt.verify(stateData.token);
        await this.oauth.link(payload.userId, profile);
        return res.redirect(`${front}/settings?linked=${provider}`);
      }

      const result = await this.oauth.loginOrRegister(profile);
      this.logger.log(`Logowanie przez ${provider}: użytkownik ${result.user.id}, nowy=${result.isNew}`);
      return res.redirect(`${front}/auth/callback?token=${result.token}&isNew=${result.isNew}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(
        `Logowanie przez ${provider} nie powiodło się (${stateData.action}): ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
      return fail(msg);
    }
  }

  @Delete(':provider')
  @UseGuards(JwtAuthGuard)
  unlink(@Param('provider') provider: string, @Req() req) {
    if (!isProvider(provider)) throw new BadRequestException(`Nieobsługiwany dostawca: ${provider}`);
    return this.oauth.unlink(req.user.userId, provider);
  }
}
