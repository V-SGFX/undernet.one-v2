import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
// import { MetricsModule } from './metrics/metrics.module'; // TEMPORARILY DISABLED - DI issue
import { AuthModule } from './auth/auth.module';
import { OAuthModule } from './oauth/oauth.module';
import { PremiumModule } from './premium/premium.module';
import { CollectionsModule } from './collections/collections.module';
import { NotesModule } from './notes/notes.module';
import { AlertsModule } from './alerts/alerts.module';
import { StripeModule } from './stripe/stripe.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { FollowsModule } from './follows/follows.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { ModerationModule } from './moderation/moderation.module';
import { NsfwModule } from './nsfw/nsfw.module';
import { TagsModule } from './tags/tags.module';
import { TranslationsModule } from './translations/translations.module';
import { CommunitiesModule } from './communities/communities.module';
import { ContentModule } from './content/content.module';
import { MediaModule } from './media/media.module';
import { FeedModule } from './feed/feed.module';
import { MailModule } from './mail/mail.module';
import { HealthController } from './health.controller';
import { AdsModule } from './ads/ads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    PrismaModule,
    RedisModule,
    QueueModule,
    MailModule,
    AuthModule,
    OAuthModule,
    PremiumModule,
    CollectionsModule,
    NotesModule,
    AlertsModule,
    StripeModule,
    UsersModule,
    PostsModule,
    CommentsModule,
    FollowsModule,
    UploadsModule,
    NotificationsModule,
    SearchModule,
    NsfwModule,
    ModerationModule,
    TagsModule,
    TranslationsModule,
    AdsModule,
    CommunitiesModule,
    ContentModule,
    MediaModule,
    FeedModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
