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

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  CreateSubmissionDto,
  RequestChangesDto,
  ResubmitDto,
  SubmissionActionDto,
  SubmissionQueryDto,
} from './dto/submission.dto.js';
import { SubmissionsService } from './submissions.service.js';

@Controller('submissions')
@UseGuards(AuthenticationGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @Post()
  @RequireRoles('SOCIETY_OFFICER')
  create(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.service.create(principal, dto);
  }

  @Get()
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: SubmissionQueryDto,
  ) {
    return this.service.list(principal, query);
  }

  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(principal, id);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequireRoles('SOCIETY_OFFICER')
  submit(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SubmissionActionDto,
  ) {
    return this.service.submit(principal, id, dto);
  }

  @Post(':id/resubmit')
  @HttpCode(200)
  @RequireRoles('SOCIETY_OFFICER')
  resubmit(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResubmitDto,
  ) {
    return this.service.resubmit(principal, id, dto);
  }

  @Post(':id/start-review')
  @HttpCode(200)
  @RequireRoles('DISTRICT_MANAGER', 'HQ_ADMIN')
  startReview(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SubmissionActionDto,
  ) {
    return this.service.startReview(principal, id, dto);
  }

  @Post(':id/request-changes')
  @HttpCode(200)
  @RequireRoles('DISTRICT_MANAGER', 'HQ_ADMIN')
  requestChanges(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RequestChangesDto,
  ) {
    return this.service.requestChanges(principal, id, dto);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequireRoles('DISTRICT_MANAGER', 'HQ_ADMIN')
  approve(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SubmissionActionDto,
  ) {
    return this.service.approve(principal, id, dto);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequireRoles('DISTRICT_MANAGER', 'HQ_ADMIN')
  reject(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SubmissionActionDto,
  ) {
    return this.service.reject(principal, id, dto);
  }
}