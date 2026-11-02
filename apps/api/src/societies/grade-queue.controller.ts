import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  GRADE_QUEUE_STATUSES,
  GradeQueueService,
  type GradeQueueStatus,
} from './grade-queue.service.js';

export class GradeQueueQueryDto {
  @IsOptional() @IsIn(GRADE_QUEUE_STATUSES) status?: GradeQueueStatus;
}

/** V5 D22 / D22r. HQ only; requesters see their requests on the society record. */
@Controller('grade-requests')
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles('HQ_ADMIN')
export class GradeQueueController {
  constructor(private readonly service: GradeQueueService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Query() query: GradeQueueQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.list(query.status ?? 'WAITING', principal);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.detail(id, principal);
  }
}
