import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { AuthorsService } from './authors.service';
import { AuthorsController } from './authors.controller';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { MediaModule } from '../media/media.module';

/**
 * Warstwa wiedzy: materiały, autorzy, kategorie.
 *
 * Jeden moduł zamiast trzech — te trzy rzeczy nie istnieją bez siebie
 * i zawsze zmieniają się razem. Osobne moduły dawałyby trzy pliki
 * konfiguracji dla jednej domeny.
 */
@Module({
  // MediaModule, bo podmiana okładki musi zwolnić poprzedni plik.
  imports: [MediaModule],
  controllers: [ContentController, AuthorsController, CategoriesController],
  providers: [ContentService, AuthorsService, CategoriesService],
  exports: [ContentService],
})
export class ContentModule {}
