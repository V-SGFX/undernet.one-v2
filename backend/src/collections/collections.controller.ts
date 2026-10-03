import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, Req,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('collections')
@UseGuards(JwtAuthGuard)
export class CollectionsController {
  constructor(private collections: CollectionsService) {}

  @Get()
  list(@Req() req) {
    return this.collections.list(req.user.userId);
  }

  /**
   * W których kolekcjach leży dana rzecz.
   *
   * Trasa dosłowna, więc MUSI stać przed `:id` — Express dopasowuje
   * w kolejności deklaracji, a „gdzie-jest" pasuje do `:id` równie dobrze.
   */
  @Get('gdzie-jest')
  whereIs(
    @Query('postId') postId: string | undefined,
    @Query('contentItemId') contentItemId: string | undefined,
    @Req() req,
  ) {
    return this.collections.whereIs(req.user.userId, {
      postId: postId ? Number(postId) : undefined,
      contentItemId: contentItemId ? Number(contentItemId) : undefined,
    });
  }

  @Get(':id')
  byId(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.collections.byId(req.user.userId, id);
  }

  @Post()
  create(@Body() body: any, @Req() req) {
    return this.collections.create(req.user.userId, body);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.collections.update(req.user.userId, id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.collections.remove(req.user.userId, id);
  }

  @Post(':id/items')
  addItem(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.collections.addItem(req.user.userId, id, body);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req,
  ) {
    return this.collections.removeItem(req.user.userId, id, itemId);
  }
}
