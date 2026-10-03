import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { PremiumModule } from '../premium/premium.module';
import { SearchService } from './search.service';

@Module({
  // PremiumModule: filtry wyszukiwania podlegają przełącznikowi w panelu.
  imports: [PremiumModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
