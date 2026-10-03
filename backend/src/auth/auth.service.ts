import { Injectable, Logger, BadRequestException, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { OZDOBY_SELECT, PROFIL_KONTA_SELECT, profilKonta } from '../common/ozdoby';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) {}

  async register(email: string, username: string, password: string) {
    if (!email || !username || !password) {
      throw new BadRequestException('Email, username and password are required');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      throw new ConflictException('Email or username already taken');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const emailVerifyToken = randomBytes(32).toString('hex');
    const user = await this.prisma.user.create({
      data: { email, username, passwordHash, emailVerifyToken, isEmailVerified: false },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });

    // Send verification email (non-blocking)
    /*
     * Wysyłka listu potwierdzającego NIE MOŻE być połykana po cichu.
     *
     * Stało tu `.catch(() => {})`. Gdy poczta nie działała — a nie działała
     * miesiącami, bo pola SMTP w .env były puste — rejestracja kończyła się
     * sukcesem, list nigdy nie wychodził, a konto zostawało na zawsze
     * niepotwierdzone i niezdolne do zalogowania. Nikt się o tym nie
     * dowiadywał: ani użytkownik, ani log.
     *
     * Konto zostaje założone (adres i nazwa są już zajęte, a cofanie
     * tworzyłoby własne problemy), ale awaria trafia do logu, a użytkownik
     * dostaje wprost informację, że list nie wyszedł i co z tym zrobić.
     */
    let mailSent = true;
    try {
      await this.mail.sendVerificationEmail(email, username, emailVerifyToken);
    } catch (e: any) {
      mailSent = false;
      this.logger.error(
        `Nie wysłano listu potwierdzającego na ${email}: ${e?.message ?? 'nieznany powód'}`,
        e?.stack,
      );
    }

    return {
      user,
      mailSent,
      message: mailSent
        ? 'Sprawdź skrzynkę — wysłaliśmy link potwierdzający. Bez potwierdzenia nie da się zalogować.'
        : 'Konto założone, ale nie udało się wysłać listu potwierdzającego. '
          + 'Użyj opcji „wyślij ponownie” na stronie logowania albo napisz do nas.',
    };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });
    if (!user) {
      throw new BadRequestException('Nieprawidłowy lub wygasły token weryfikacji');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerifyToken: null },
    });
    const jwtToken = this.jwt.sign({ userId: user.id, role: user.role });
    return {
      user: profilKonta(user),
      token: jwtToken,
      message: 'Email został potwierdzony!',
    };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return { message: 'Jeśli konto istnieje, wysłaliśmy email weryfikacyjny.' };
    }
    if (user.isEmailVerified) {
      return { message: 'Email jest już potwierdzony.' };
    }
    const emailVerifyToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken },
    });
    // Tu również bez cichego połykania: użytkownik prosi o list wprost,
    // więc musi się dowiedzieć, jeśli znowu nie wyszedł.
    try {
      await this.mail.sendVerificationEmail(email, user.username, emailVerifyToken);
    } catch (e: any) {
      this.logger.error(`Ponowna wysyłka na ${email} nie powiodła się: ${e?.message}`);
      throw new BadRequestException(
        'Nie udało się wysłać listu. Poczta serwisu może chwilowo nie działać — spróbuj później.',
      );
    }
    return { message: 'Jeśli konto istnieje, wysłaliśmy email weryfikacyjny.' };
  }

  async login(login: string, password: string) {
    if (!login || !password) {
      throw new BadRequestException('Login and password are required');
    }
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { username: login }],
        isActive: true,
      },
    });
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Potwierdź swój adres email przed zalogowaniem. Sprawdź skrzynkę pocztową.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });
    const token = this.jwt.sign({ userId: user.id, role: user.role });
    return {
      user: profilKonta(user),
      token,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return same message to prevent email enumeration
    const msg = { message: 'Jeśli konto z tym emailem istnieje, wysłaliśmy link do resetu hasła.' };
    if (!user) return msg;

    const passwordResetToken = randomBytes(32).toString('hex');
    const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken, passwordResetExpires },
    });
    /*
     * Tutaj odpowiedź celowo pozostaje ta sama niezależnie od wyniku —
     * inaczej formularz zdradzałby, które adresy istnieją. Ale awaria
     * musi trafić do logu, żeby dało się ją zauważyć.
     */
    this.mail.sendPasswordResetEmail(email, user.username, passwordResetToken)
      .catch((e) => this.logger.error(`Reset hasła: nie wysłano na ${email}: ${e?.message}`));
    return msg;
  }

  /**
   * Wymuszony reset hasła — z panelu administracyjnego.
   *
   * Różni się od „zapomniałem hasła" dwiema rzeczami, i obie są celowe:
   *
   *  1. UNIEWAŻNIA bieżące hasło. Zwykły reset zostawia stare działające,
   *     dopóki ktoś nie użyje linku — a administrator sięga po tę funkcję
   *     zwykle wtedy, gdy chce odciąć dostęp NATYCHMIAST.
   *  2. Nie ukrywa, czy konto istnieje. Enumeracja adresów ma sens przy
   *     formularzu publicznym; tutaj po drugiej stronie stoi już
   *     zalogowany administrator, a cicha odmowa oznaczałaby, że nie wie,
   *     czy operacja się udała.
   *
   * Hasła nie ustawiamy ani nie pokazujemy nikomu — użytkownik nadaje je
   * sobie sam przez link. Administrator nie musi go znać, żeby go zmienić.
   */
  async adminForcePasswordReset(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Nie ma użytkownika o tym numerze');

    const passwordResetToken = randomBytes(32).toString('hex');
    const passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    /*
     * Najpierw list, potem unieważnienie hasła.
     *
     * Odwrotna kolejność przy niedziałającej poczcie zamykałaby konto bez
     * żadnej drogi powrotu: stare hasło już nie działa, a linku nikt nie
     * dostał. Jeśli wysyłka padnie, hasło zostaje takie, jakie było.
     */
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordResetToken, passwordResetExpires },
    });

    /*
     * Niepowodzenie wysyłki musi wrócić jako czytelny powód, nie jako 500.
     * Administrator ma się dowiedzieć, że poczta nie działa — inaczej
     * zobaczy „Internal server error" i nie będzie wiedział, czy hasło
     * zostało zmienione, czy nie.
     */
    try {
      await this.mail.sendPasswordResetEmail(user.email, user.username, passwordResetToken);
    } catch (e: any) {
      throw new BadRequestException(
        `Nie udało się wysłać listu na ${user.email} — hasło pozostało bez zmian. ` +
        `Sprawdź konfigurację SMTP. Powód: ${e?.message ?? 'nieznany'}`,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: null },
    });

    return {
      ok: true,
      email: user.email,
      username: user.username,
      expiresAt: passwordResetExpires,
    };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('Nieprawidłowy lub wygasły token resetu hasła');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    });
    return { message: 'Hasło zostało zmienione. Możesz się teraz zalogować.' };
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // Pełny profil, ten sam kształt co przy logowaniu — inaczej
      // formularz ustawień hydratuje się z uboższej wersji i pokazuje
      // puste pola mimo wypełnionego konta.
      select: PROFIL_KONTA_SELECT,
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
