import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private from: string;
  private logger = new Logger(MailService.name);

  constructor(private config: ConfigService) {
    /*
     * Nazwy zmiennych przyszły ze szkieletu xdtv i nie zgadzały się z tym,
     * co stoi w .env tego projektu: MAIL_FROM, SMTP_PASSWORD, PUBLIC_URL.
     * Efekt był cichy i kosztowny — serwer logował się do SMTP bez hasła,
     * a linki potwierdzające adres prowadziły na wartość domyślną.
     * Czytamy obie nazwy, pierwszeństwo ma ta z pliku.
     */
    this.from = config.get('MAIL_FROM') || config.get('SMTP_FROM') || 'UNDERNET.ONE <noreply@undernet.one>';
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: Number(config.get('SMTP_PORT', 587)),
      secure: false,
      auth: {
        user: config.get('SMTP_USER'),
        pass: config.get('SMTP_PASSWORD') || config.get('SMTP_PASS'),
      },
    });
  }

  async sendVerificationEmail(to: string, username: string, token: string) {
    const frontendUrl = this.config.get('PUBLIC_URL') || this.config.get('FRONTEND_URL') || 'https://undernet.one';
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Potwierdź swój adres email — UNDERNET.ONE',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a0f; color: #e0e0e0; padding: 32px; border-radius: 12px;">
          <h1 style="color: #00D4FF; text-align: center; margin-bottom: 24px;">UNDERNET.ONE</h1>
          <p>Cześć <strong>${username}</strong>,</p>
          <p>Dziękujemy za rejestrację! Kliknij poniższy przycisk, aby potwierdzić swój adres email:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}" style="background: #00D4FF; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Potwierdź email
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">Jeśli nie zakładałeś konta na UNDERNET.ONE, zignoruj tę wiadomość.</p>
          <p style="color: #888; font-size: 13px;">Link jest ważny przez 24 godziny.</p>
        </div>
      `,
    });
    this.logger.log(`Verification email sent to ${to}`);
  }

  async sendPasswordResetEmail(to: string, username: string, token: string) {
    const frontendUrl = this.config.get('PUBLIC_URL') || this.config.get('FRONTEND_URL') || 'https://undernet.one';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Reset hasła — UNDERNET.ONE',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a0f; color: #e0e0e0; padding: 32px; border-radius: 12px;">
          <h1 style="color: #00D4FF; text-align: center; margin-bottom: 24px;">UNDERNET.ONE</h1>
          <p>Cześć <strong>${username}</strong>,</p>
          <p>Otrzymaliśmy prośbę o reset hasła. Kliknij poniższy przycisk, aby ustawić nowe hasło:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="background: #00D4FF; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Resetuj hasło
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
          <p style="color: #888; font-size: 13px;">Link jest ważny przez 1 godzinę.</p>
        </div>
      `,
    });
    this.logger.log(`Password reset email sent to ${to}`);
  }
}
