import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  BusinessInputDto,
  BusinessUpdateDto,
  OutputInputDto,
  OutputUpdateDto,
  PageQueryDto,
  ProductionCorrectionDto,
  ProductionListQueryDto,
  ProductionRecordInputDto,
  ProductionSummaryQueryDto,
} from './economy.dto.js';
import { EconomyService } from './economy.service.js';

const uuid = () => new ParseUUIDPipe();

/**
 * Issue #145: Village Economic Profile. Reads follow the society record's
 * scope; only the assigned Society Officer writes (checked per society in
 * the service, so other roles get 403 on a society they can see and 404 on
 * one they cannot).
 */
@Controller()
@UseGuards(AuthenticationGuard, RolesGuard)
export class EconomyController {
  constructor(private readonly service: EconomyService) {}

  @Get('societies/:id/economic-profile')
  profile(
    @Param('id', uuid()) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.profile(id, principal);
  }

  @Post('societies/:id/businesses')
  @RequireRoles('SOCIETY_OFFICER')
  createBusiness(
    @Param('id', uuid()) id: string,
    @Body() input: BusinessInputDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createBusiness(id, input, principal);
  }

  @Patch('businesses/:id')
  @RequireRoles('SOCIETY_OFFICER')
  updateBusiness(
    @Param('id', uuid()) id: string,
    @Body() input: BusinessUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateBusiness(id, input, principal);
  }

  @Post('businesses/:id/outputs')
  @RequireRoles('SOCIETY_OFFICER')
  createOutput(
    @Param('id', uuid()) id: string,
    @Body() input: OutputInputDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createOutput(id, input, principal);
  }

  @Patch('business-outputs/:id')
  @RequireRoles('SOCIETY_OFFICER')
  updateOutput(
    @Param('id', uuid()) id: string,
    @Body() input: OutputUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateOutput(id, input, principal);
  }

  @Get('business-outputs/:id/production-records')
  outputRecords(
    @Param('id', uuid()) id: string,
    @Query() query: PageQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.outputRecords(id, query, principal);
  }

  /** 201 when saved, 200 when this save was already made (a retry). */
  @Post('business-outputs/:id/production-records')
  @RequireRoles('SOCIETY_OFFICER')
  async createRecord(
    @Param('id', uuid()) id: string,
    @Body() input: ProductionRecordInputDto,
    @CurrentPrincipal() principal: Principal,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.createRecord(id, input, principal);
    if (!result.created) response.status(200);
    return result;
  }

  @Patch('production-records/:id')
  @RequireRoles('SOCIETY_OFFICER')
  @HttpCode(200)
  correctRecord(
    @Param('id', uuid()) id: string,
    @Body() input: ProductionCorrectionDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.correctRecord(id, input, principal);
  }

  @Get('production-records/:id/history')
  history(
    @Param('id', uuid()) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.history(id, principal);
  }

  @Get('economic-profile/production')
  summary(
    @Query() query: ProductionSummaryQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.summary(query, principal);
  }

  @Get('economic-profile/production-records')
  listRecords(
    @Query() query: ProductionListQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listRecords(query, principal);
  }
}
