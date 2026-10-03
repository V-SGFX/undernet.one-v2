import {
  Controller, Get, Post, Delete, Param, Query, Body, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private notes: NotesService) {}

  @Get()
  list(@Req() req) {
    return this.notes.list(req.user.userId);
  }

  /** Trasa dosłowna MUSI stać przed `:id`. */
  @Get('do')
  forTarget(
    @Query('postId') postId: string | undefined,
    @Query('contentItemId') contentItemId: string | undefined,
    @Req() req,
  ) {
    return this.notes.forTarget(req.user.userId, {
      postId: postId ? Number(postId) : undefined,
      contentItemId: contentItemId ? Number(contentItemId) : undefined,
    });
  }

  @Post()
  save(@Body() body: any, @Req() req) {
    return this.notes.save(
      req.user.userId,
      { postId: body.postId, contentItemId: body.contentItemId },
      body.body ?? '',
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.notes.remove(req.user.userId, id);
  }
}
