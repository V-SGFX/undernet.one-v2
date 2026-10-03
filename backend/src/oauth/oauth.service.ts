import {
  Injectable, Logger, BadRequestException, ConflictException, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Logowanie kontem zewnętrznym.
 *
 * Trzy dostawcy i ani jednego więcej. Wersja odziedziczona po xdtv.fans
 * obsługiwała Twitcha, Kicka, YouTube'a i TikToka, bo tamten serwis stoi
 * na streamerach — tutaj te konta nie znaczą nic i prowadziły wyłącznie
 * do zepsutego przycisku. Discord został, bo społeczność techniczna
 * faktycznie tam siedzi; Google i GitHub doszły, bo to konta, które
 * czytelnicy tego portalu naprawdę mają.
 */
export type ProviderName = 'discord' | 'google' | 'github';

export const PROVIDERS: ProviderName[] = ['discord', 'google', 'github'];

/** Kolumna w `users` trzymająca identyfikator u danego dostawcy. */
const ID_FIELD: Record<ProviderName, 'discordId' | 'googleId' | 'githubId'> = {
  discord: 'discordId',
  google: 'googleId',
  github: 'githubId',
};

export interface ExternalProfile {
  provider: ProviderName;
  /** Identyfikator u dostawcy — stały, w przeciwieństwie do nazwy i adresu. */
  externalId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /** Czy dostawca ma komplet danych w konfiguracji. Bez tego przycisk się nie pokaże. */
  isConfigured(provider: ProviderName): boolean {
    const prefix = provider.toUpperCase();
    return Boolean(
      this.config.get(`${prefix}_CLIENT_ID`) && this.config.get(`${prefix}_CLIENT_SECRET`),
    );
  }

  configuredProviders(): ProviderName[] {
    return PROVIDERS.filter((p) => this.isConfigured(p));
  }

  private redirectUri(provider: ProviderName): string {
    const base = this.config.get('PUBLIC_URL', 'https://undernet.one');
    return `${base}/api/oauth/${provider}/callback`;
  }

  // ─────────────────────────────── krok 1: zgoda ───────────────────────────────

  buildAuthorizeUrl(provider: ProviderName, state: string): string {
    const clientId = this.config.get(`${provider.toUpperCase()}_CLIENT_ID`, '');
    const redirectUri = this.redirectUri(provider);

    switch (provider) {
      case 'discord': {
        const q = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'identify email',
          state,
        });
        return `https://discord.com/oauth2/authorize?${q}`;
      }
      case 'google': {
        const q = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'openid email profile',
          state,
          // Bez tego Google przy drugim logowaniu pomija ekran zgody
          // i nie zwraca adresu e-mail.
          access_type: 'online',
          prompt: 'select_account',
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
      }
      case 'github': {
        const q = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          // `user:email` jest konieczne — GitHub domyślnie nie podaje adresu,
          // jeśli użytkownik ukrył go w ustawieniach profilu.
          scope: 'read:user user:email',
          state,
        });
        return `https://github.com/login/oauth/authorize?${q}`;
      }
    }
  }

  // ──────────────────────── krok 2: kod → profil użytkownika ───────────────────

  async fetchProfile(provider: ProviderName, code: string): Promise<ExternalProfile> {
    const clientId = this.config.get(`${provider.toUpperCase()}_CLIENT_ID`, '');
    const clientSecret = this.config.get(`${provider.toUpperCase()}_CLIENT_SECRET`, '');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(`Dostawca ${provider} nie jest skonfigurowany`);
    }

    const accessToken = await this.exchangeCode(provider, code, clientId, clientSecret);

    switch (provider) {
      case 'discord':
        return this.discordProfile(accessToken);
      case 'google':
        return this.googleProfile(accessToken);
      case 'github':
        return this.githubProfile(accessToken);
    }
  }

  private async exchangeCode(
    provider: ProviderName, code: string, clientId: string, clientSecret: string,
  ): Promise<string> {
    const endpoints: Record<ProviderName, string> = {
      discord: 'https://discord.com/api/oauth2/token',
      google: 'https://oauth2.googleapis.com/token',
      github: 'https://github.com/login/oauth/access_token',
    };

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri(provider),
    });

    const res = await fetch(endpoints[provider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // GitHub domyślnie odpowiada formularzem, nie JSON-em.
        Accept: 'application/json',
      },
      body,
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      const reason = data.error_description || data.error || `HTTP ${res.status}`;
      throw new BadRequestException(`Wymiana kodu u dostawcy ${provider} nie powiodła się: ${reason}`);
    }
    return data.access_token;
  }

  private async discordProfile(token: string): Promise<ExternalProfile> {
    const res = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new BadRequestException('Discord odmówił wydania profilu');
    const u: any = await res.json();
    return {
      provider: 'discord',
      externalId: String(u.id),
      username: u.username,
      email: u.verified ? u.email ?? null : null,
      avatarUrl: u.avatar
        ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`
        : null,
    };
  }

  private async googleProfile(token: string): Promise<ExternalProfile> {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new BadRequestException('Google odmówił wydania profilu');
    const u: any = await res.json();
    return {
      provider: 'google',
      externalId: String(u.sub),
      username: u.name || (u.email ? String(u.email).split('@')[0] : 'uzytkownik'),
      // `email_verified` bywa łańcuchem "true", nie wartością logiczną.
      email: String(u.email_verified) === 'true' ? u.email ?? null : null,
      avatarUrl: u.picture ?? null,
    };
  }

  private async githubProfile(token: string): Promise<ExternalProfile> {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      // GitHub odrzuca zapytania bez nagłówka User-Agent.
      'User-Agent': 'undernet.one',
    };

    const res = await fetch('https://api.github.com/user', { headers });
    if (!res.ok) throw new BadRequestException('GitHub odmówił wydania profilu');
    const u: any = await res.json();

    // Adres publiczny bywa pusty. Prawdziwy leży pod osobnym adresem
    // i tylko tam widać, który jest potwierdzony i główny.
    let email: string | null = u.email ?? null;
    if (!email) {
      const mails = await fetch('https://api.github.com/user/emails', { headers })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      const primary = (mails as any[]).find((m) => m.primary && m.verified);
      email = primary?.email ?? null;
    }

    return {
      provider: 'github',
      externalId: String(u.id),
      username: u.login,
      email,
      avatarUrl: u.avatar_url ?? null,
    };
  }

  // ───────────────────────── krok 3: konto w naszej bazie ──────────────────────

  async loginOrRegister(profile: ExternalProfile) {
    const field = ID_FIELD[profile.provider];

    // 1. Konto już powiązane z tym kontem zewnętrznym.
    const linked = await this.prisma.user.findFirst({ where: { [field]: profile.externalId } });
    if (linked) {
      if (!linked.isActive) throw new BadRequestException('Konto jest zablokowane');
      return { token: this.sign(linked), user: this.publicUser(linked), isNew: false };
    }

    // 2. Konto z tym samym potwierdzonym adresem — dopinamy dostawcę.
    //
    // Adres bierzemy pod uwagę TYLKO gdy dostawca potwierdził, że należy
    // do użytkownika. Bez tego warunku wystarczyłoby założyć u dostawcy
    // konto na cudzy adres, żeby przejąć konto w serwisie.
    if (profile.email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      if (byEmail) {
        if (!byEmail.isActive) throw new BadRequestException('Konto jest zablokowane');
        const updated = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            [field]: profile.externalId,
            avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl,
            isEmailVerified: true,
          },
        });
        return { token: this.sign(updated), user: this.publicUser(updated), isNew: false };
      }
    }

    // 3. Nowe konto.
    const username = await this.uniqueUsername(profile.username);
    const created = await this.prisma.user.create({
      data: {
        // Bez adresu od dostawcy zapisujemy zastępczy w domenie, której nie ma
        // w DNS — konto działa, a użytkownik podaje prawdziwy adres w ustawieniach.
        email: profile.email ?? `${profile.provider}_${profile.externalId}@konta.undernet.local`,
        username,
        displayName: profile.username,
        avatarUrl: profile.avatarUrl,
        isEmailVerified: Boolean(profile.email),
        [field]: profile.externalId,
      },
    });

    this.logger.log(`Nowe konto przez ${profile.provider}: ${created.username} (#${created.id})`);
    return { token: this.sign(created), user: this.publicUser(created), isNew: true };
  }

  /** Dopięcie dostawcy do konta, na którym użytkownik jest już zalogowany. */
  async link(userId: number, profile: ExternalProfile) {
    const field = ID_FIELD[profile.provider];

    const taken = await this.prisma.user.findFirst({
      where: { [field]: profile.externalId, NOT: { id: userId } },
    });
    if (taken) {
      throw new ConflictException(`To konto ${profile.provider} jest już przypisane do innego użytkownika`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { [field]: profile.externalId },
    });
    return { linked: profile.provider };
  }

  /**
   * Odpięcie dostawcy.
   *
   * Blokujemy odpięcie ostatniej metody logowania — inaczej konto bez hasła
   * i bez powiązań staje się niedostępne dla właściciela.
   */
  async unlink(userId: number, provider: ProviderName) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Nie znaleziono konta');

    const linkedCount = PROVIDERS.filter((p) => user[ID_FIELD[p]]).length;
    if (!user.passwordHash && linkedCount <= 1) {
      throw new BadRequestException(
        'To jedyny sposób logowania na to konto. Ustaw najpierw hasło.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { [ID_FIELD[provider]]: null },
    });
    return { unlinked: provider };
  }

  async connected(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Nie znaleziono konta');
    return PROVIDERS.map((p) => ({
      provider: p,
      connected: Boolean(user[ID_FIELD[p]]),
      configured: this.isConfigured(p),
    }));
  }

  // ──────────────────────────────── pomocnicze ─────────────────────────────────

  private sign(user: { id: number; role: string }) {
    return this.jwt.sign({ userId: user.id, role: user.role });
  }

  private publicUser(u: any) {
    const { passwordHash, emailVerifyToken, passwordResetToken, passwordResetExpires, ...rest } = u;
    return rest;
  }

  private async uniqueUsername(base: string): Promise<string> {
    const clean =
      base
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20) || 'uzytkownik';

    if (!(await this.prisma.user.findUnique({ where: { username: clean } }))) return clean;

    for (let i = 0; i < 10; i += 1) {
      const candidate = `${clean}_${Math.random().toString(36).slice(2, 6)}`;
      if (!(await this.prisma.user.findUnique({ where: { username: candidate } }))) return candidate;
    }
    return `${clean}_${Date.now().toString(36)}`;
  }
}
