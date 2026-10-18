import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import { DemoAuthGuard } from '../auth/demo-auth.guard.js';
import type { Principal } from '../auth/principal.js';
import { DocumentsService } from './documents.service.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import { DocumentQueryDto } from './dto/document-query.dto.js';

@Controller('documents')
@UseGuards(DemoAuthGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  /** Uploaded documents the user may see, filtered by society, district, type and status. */
  @Get()
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: DocumentQueryDto,
  ) {
    return this.service.list(principal, query);
  }

  /** Records document metadata and returns a pre-signed upload URL. */
  @Post()
  create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateDocumentDto,
  ) {
    return this.service.create(principal, body);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(principal, id);
  }

  /** Confirms the upload and submits the document for review. */
  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.completeUpload(principal, id);
  }

  /** A pre-signed download URL for a document the user may open. */
  @Get(':id/download')
  download(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.createDownload(principal, id);
  }
}
