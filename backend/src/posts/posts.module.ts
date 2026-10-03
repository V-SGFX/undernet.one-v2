import { Module, forwardRef } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { TagsModule } from '../tags/tags.module';
import { FeedModule } from '../feed/feed.module';

@Module({
  imports: [TagsModule, forwardRef(() => FeedModule)],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
