import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { AuthorsService } from './authors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('authors')
export class AuthorsController {
  constructor(private authors: AuthorsService) {}

  @Get()
  list() {
    return this.authors.list();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.authors.bySlug(slug);
  }

  // Profil autora zakłada redakcja — autorem bywa osoba bez konta,
  // więc nie może to być samoobsługa użytkownika.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR')
  create(@Body() body: any) {
    return this.authors.create(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.authors.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.authors.remove(id);
  }
}
