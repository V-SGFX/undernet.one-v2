import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('content-categories')
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  /** Całe drzewo — menu i okruszki potrzebują struktury, nie płaskiej listy. */
  /** `?type=WIKI` zawęża licznik do jednego rodzaju materiału. */
  @Get()
  tree(@Query('type') type?: string) {
    return this.categories.tree(type);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.categories.bySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR')
  create(@Body() body: any) {
    return this.categories.create(body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.categories.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categories.remove(id);
  }
}
