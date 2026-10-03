import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  // UploadsModule, bo wgranie grafiki i wpis w bibliotece to jedno żądanie.
  imports: [UploadsModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
