import {
  Controller, Post, Get, Body, Req, Query, Headers, UseGuards,
  HttpCode, BadRequestException, UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.username, dto.password);
  }

  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  resendVerification(@Body('email') email: string) {
    return this.authService.resendVerification(email);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.login, dto.password);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /**
   * Wymuszony reset hasła, wołany przez wspólny panel administracyjny.
   *
   * Panel stoi w backendzie xdtv i sięga do bazy undernetu drugim klientem
   * Prismy — ale wysyłka poczty należy do TEGO serwisu: to stąd idzie
   * właściwy nadawca, właściwy szablon i link na undernet.one. Dlatego
   * panel woła ten adres zamiast pisać po bazie na własną rękę.
   *
   * Chronione osobnym sekretem, nie tokenem użytkownika: po drugiej
   * stronie nie stoi konto undernetu, tylko inny nasz proces.
   */
  @Post('admin/force-password-reset')
  @HttpCode(200)
  async adminForcePasswordReset(
    @Body() body: { userId?: number },
    @Headers('x-admin-secret') secret: string | undefined,
  ) {
    const expected = process.env.ADMIN_API_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Nieprawidłowy sekret');
    }
    if (!body?.userId) throw new BadRequestException('Podaj userId');
    return this.authService.adminForcePasswordReset(Number(body.userId));
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req) {
    return this.authService.getProfile(req.user.userId);
  }
}
