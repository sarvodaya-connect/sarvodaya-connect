import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  DOCUMENT_STORAGE,
  type DocumentStorage,
  safeDownloadName,
} from './document-storage.js';
import {
  LocalDocumentStorage,
  UploadSizeMismatchError,
} from './local-document-storage.js';

/**
 * Upload and download endpoints for the local storage driver. They play the
 * role of S3 pre-signed URLs in development: each link is signed, expires and
 * is limited to one file, method, content type and size.
 */
@Controller('storage/local')
export class LocalStorageController {
  constructor(
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
  ) {}

  @Put(':token')
  @HttpCode(200)
  async upload(
    @Param('token') token: string,
    @Req() request: Request,
  ): Promise<void> {
    const storage = this.localStorage();
    const link = storage.verifyToken(token, 'PUT');
    if (!link || link.sz === undefined) {
      throw new ForbiddenException(
        'This upload link is invalid or has expired',
      );
    }
    const contentType = (request.headers['content-type'] ?? '')
      .split(';')[0]!
      .trim()
      .toLowerCase();
    if (contentType !== link.ct) {
      throw new BadRequestException(
        'Content-Type must match the upload request',
      );
    }
    try {
      await storage.writeObject(link.k, request, link.sz);
    } catch (error) {
      if (error instanceof UploadSizeMismatchError) {
        throw new BadRequestException(
          'The file size does not match the upload request',
        );
      }
      throw error;
    }
  }

  @Get(':token')
  async download(
    @Param('token') token: string,
    @Res() response: Response,
  ): Promise<void> {
    const storage = this.localStorage();
    const link = storage.verifyToken(token, 'GET');
    if (!link)
      throw new ForbiddenException(
        'This download link is invalid or has expired',
      );
    const object = await storage.openObject(link.k);
    if (!object) throw new NotFoundException('File not found');
    response.setHeader('Content-Type', link.ct);
    response.setHeader('Content-Length', String(object.sizeBytes));
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeDownloadName(link.fn ?? 'document')}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    object.stream.pipe(response);
  }

  private localStorage(): LocalDocumentStorage {
    if (!(this.storage instanceof LocalDocumentStorage))
      throw new NotFoundException();
    return this.storage;
  }
}
