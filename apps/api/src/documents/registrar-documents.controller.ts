import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { RegistrarDocumentsService } from './registrar-documents.service.js';
import { REGISTRAR_DOCUMENT_TYPES } from './upload-rules.js';

export class RegistrarYearQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year?: number;
}

export class MissingDocumentsQueryDto extends RegistrarYearQueryDto {
  @IsOptional()
  @IsIn(REGISTRAR_DOCUMENT_TYPES)
  documentType: (typeof REGISTRAR_DOCUMENT_TYPES)[number] = 'AUDIT_REPORT';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

/** V5 PR 4: submitted and missing Registrar documents. */
@Controller()
@UseGuards(AuthenticationGuard, RolesGuard)
export class RegistrarDocumentsController {
  constructor(private readonly service: RegistrarDocumentsService) {}

  /** M13 / D05 Documents tab: anyone who can view the society. */
  @Get('societies/:id/registrar-documents')
  forSociety(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: RegistrarYearQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.forSociety(id, query.year, principal);
  }

  /** D11 / D12: HQ only. */
  @Get('registrar-documents/totals')
  @RequireRoles('HQ_ADMIN')
  totals(@Query() query: RegistrarYearQueryDto) {
    return this.service.totals(query.year);
  }

  /** D11 "Needs follow-up": HQ only, one page at a time. */
  @Get('registrar-documents/missing')
  @RequireRoles('HQ_ADMIN')
  missing(@Query() query: MissingDocumentsQueryDto) {
    return this.service.missing(
      query.documentType,
      query.year,
      query.page,
      query.pageSize,
    );
  }
}
