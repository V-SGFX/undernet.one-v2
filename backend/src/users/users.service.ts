import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { PremiumService } from '../premium/premium.service';
import { AUTOR_SELECT } from '../common/ozdoby';
import {
  KOLORY_NICKU, STYLE_NICKU, OTOCZKI_AWATARA, dozwolony, OZDOBY_SELECT,
} from '../common/ozdoby';

function sanitize(str: string): string {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Adres strony podany przez użytkownika.
 *
 * Puszczamy wyłącznie http(s). Bez tego `javascript:` w polu „website"
 * stałby się klikalnym odnośnikiem na cudzym profilu — pole tekstowe
 * zamieniłoby się w wektor ataku na każdego odwiedzającego.
 */
function adresStrony(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const zProtokolem = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(zProtokolem);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

const LIMITY = { bio: 500, location: 100 };

/**
 * Pola rozszerzonego profilu.
 *
 * Płatne jest ICH USTAWIENIE, nie odczyt — kto straci PRO, nie znika
 * z sieci ani nie traci tego, co już o sobie napisał.
 */
const POLA_PRO = ['bio', 'website', 'location', 'bannerUrl', 'nameColor', 'nameStyle', 'avatarRing'] as const;

const PROFIL_SELECT = {
  bio: true, website: true, location: true, bannerUrl: true,
  ...OZDOBY_SELECT,
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private premium: PremiumService,
  ) {}

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, username: true, displayName: true,
          avatarUrl: true, role: true, isActive: true, lastActiveAt: true, createdAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);
    return { data: users, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...AUTOR_SELECT,
        role: true, createdAt: true, ...PROFIL_SELECT,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        ...AUTOR_SELECT,
        role: true, createdAt: true, ...PROFIL_SELECT,
        _count: { select: { posts: true, comments: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPostsByUsername(username: string, page: number, limit: number) {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    const skip = (page - 1) * limit;
    const where = { authorId: user.id, isDeleted: false };
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { ...AUTOR_SELECT } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);
    return { data: posts, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, username: true, displayName: true, avatarUrl: true,
        role: true, createdAt: true, ...PROFIL_SELECT,
        _count: { select: { posts: true, comments: true, follows: true, votes: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getMyPosts(userId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { authorId: userId, isDeleted: false };
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { ...AUTOR_SELECT } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);
    return { data: posts, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async updateMe(userId: number, data: any) {
    const updateData: Record<string, unknown> = {};

    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    // Bramkę stawiamy dopiero, gdy ktoś FAKTYCZNIE rusza pola PRO —
    // inaczej zmiana samej nazwy wyświetlanej odbijałaby się od płatnej
    // ściany tylko dlatego, że formularz odsyła wszystkie pola naraz.
    const ruszaPolaPro = POLA_PRO.some((k) => data[k] !== undefined);
    if (ruszaPolaPro) {
      if (!(await this.premium.canUse(userId, 'advanced-profile'))) {
        throw new ForbiddenException('Rozszerzony profil jest częścią UNDERNET PRO.');
      }
      if (data.bio !== undefined) {
        const v = String(data.bio).trim();
        if (v.length > LIMITY.bio) throw new BadRequestException(`Opis: najwyżej ${LIMITY.bio} znaków.`);
        updateData.bio = v ? sanitize(v) : null;
      }
      if (data.location !== undefined) {
        const v = String(data.location).trim();
        if (v.length > LIMITY.location) throw new BadRequestException(`Lokalizacja: najwyżej ${LIMITY.location} znaków.`);
        updateData.location = v ? sanitize(v) : null;
      }
      if (data.website !== undefined) {
        const v = String(data.website).trim();
        if (!v) updateData.website = null;
        else {
          const adres = adresStrony(v);
          if (!adres) throw new BadRequestException('Nieprawidłowy adres strony.');
          updateData.website = adres;
        }
      }
      if (data.bannerUrl !== undefined) {
        const v = String(data.bannerUrl).trim();
        updateData.bannerUrl = v || null;
      }

      /*
       * Ozdoby: przepuszczamy WYŁĄCZNIE klucze z listy.
       * Cokolwiek innego zapisuje się jako `null` — czyli „bez ozdoby",
       * a nie jako błąd. Nieznany klucz oznacza zwykle stary front albo
       * literówkę, a nie próbę ataku; nie ma powodu odbijać całego zapisu
       * profilu przez jedno pole, którego i tak nie da się użyć.
       */
      if (data.nameColor !== undefined) {
        updateData.nameColor = dozwolony(KOLORY_NICKU, data.nameColor);
      }
      if (data.nameStyle !== undefined) {
        updateData.nameStyle = dozwolony(STYLE_NICKU, data.nameStyle);
      }
      if (data.avatarRing !== undefined) {
        updateData.avatarRing = dozwolony(OTOCZKI_AWATARA, data.avatarRing);
      }
    }

    if (data.newPassword) {
      if (!data.currentPassword) throw new BadRequestException('Current password is required');
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException();
      if (!user.passwordHash) throw new BadRequestException('Password login not available for this account');
      const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!valid) throw new BadRequestException('Current password is incorrect');
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) throw new BadRequestException('Nothing to update');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true, email: true, username: true, displayName: true,
        avatarUrl: true, role: true, createdAt: true, ...PROFIL_SELECT,
      },
    });
    return updated;
  }

  async update(id: number, requesterId: number, requesterRole: string, data: any) {
    if (requesterId !== id && requesterRole !== 'ADMIN') {
      throw new ForbiddenException();
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
      select: {
        ...AUTOR_SELECT,
        role: true, createdAt: true,
      },
    });
  }
}
