import { Controller, Post, Get, Param, Query, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { FollowsService, type FollowTarget } from './follows.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('follows')
@UseGuards(JwtAuthGuard)
export class FollowsController {
  constructor(private follows: FollowsService) {}

  /** Co obserwuję. */
  @Get()
  list(@Req() req) {
    return this.follows.list(req.user.userId);
  }

  /**
   * Zapisane wątki. Trasy dosłowne MUSZĄ stać przed `:target/:id` —
   * Express dopasowuje w kolejności deklaracji.
   */
  @Get('posts/me')
  savedPosts(@Query('limit') limit: string | undefined, @Req() req) {
    return this.follows.savedPosts(req.user.userId, limit ? Number(limit) : 48);
  }

  @Get('posts/check-batch')
  checkBatch(@Query('ids') ids: string | undefined, @Req() req) {
    const parsed = (ids ?? '')
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isInteger(x) && x > 0);
    return this.follows.arePostsSaved(req.user.userId, parsed);
  }

  @Get('post/check/:id')
  checkOne(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.follows.isPostSaved(req.user.userId, id);
  }

  /** Przełącz obserwowanie, np. POST /follows/community/12 */
  @Post(':target/:id')
  toggle(
    @Param('target') target: string,
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
  ) {
    return this.follows.toggle(req.user.userId, target as FollowTarget, id);
  }
}
