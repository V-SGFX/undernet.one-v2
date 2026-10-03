import {
  Controller, Post, UseGuards, UseInterceptors,
  UploadedFile, UploadedFiles, Param, Req, Body, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsService } from './uploads.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_FILES = 10;

@Controller('uploads')
export class UploadsController {
  constructor(
    private uploadsService: UploadsService,
  ) {}

  @Post(':category')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async upload(
    @UploadedFile() file: any,
    @Param('category') category: string,
    @Req() req,
  ) {
    const allowed = ['avatars', 'posts', 'banners', 'content'];
    if (!allowed.includes(category)) {
      throw new BadRequestException(`Invalid category. Allowed: ${allowed.join(', ')}`);
    }

    const url = await this.uploadsService.processUpload(
      file,
      category as 'avatars' | 'posts' | 'banners' | 'content',
    );

    return { url };
  }

  @Post(':category/batch')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async uploadBatch(
    @UploadedFiles() files: any[],
    @Param('category') category: string,
    @Req() req,
  ) {
    const allowed = ['posts'];
    if (!allowed.includes(category)) {
      throw new BadRequestException(`Batch upload only allowed for: ${allowed.join(', ')}`);
    }
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    if (files.length > MAX_FILES) {
      throw new BadRequestException(`Max ${MAX_FILES} files allowed`);
    }

    const urls = await Promise.all(
      files.map((file) =>
        this.uploadsService.processUpload(file, category as 'avatars' | 'posts' | 'banners'),
      ),
    );

    return { urls };
  }
}
