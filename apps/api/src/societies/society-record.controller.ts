import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  AnnualSummaryUpdateDto,
  FinancialYearQueryDto,
  GradeChangeRequestDto,
  GradeDecisionDto,
  SocietyHistoryQueryDto,
  WorkPlanQueryDto,
} from './dto/society-record.dto.js';
import { SocietyRecordService } from './society-record.service.js';

/**
 * SC-65 society record endpoints (Prototype v4, M06–M06h and D05–D05w).
 * Every handler checks the society scope and the role rule on the server.
 */
@Controller('societies')
@UseGuards(AuthenticationGuard, RolesGuard)
export class SocietyRecordController {
  constructor(private readonly service: SocietyRecordService) {}

  /** M06 / D05: the year's two totals and audit report. Defaults to the last completed year. */
  @Get(':id/annual-summary')
  annualSummary(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: FinancialYearQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.getAnnualSummary(id, query.year, principal);
  }

  /** M06f: Society Officer or assigned SPC only. */
  @Put(':id/annual-summary/:year')
  @RequireRoles('SOCIETY_OFFICER', 'PROGRAMME_COORDINATOR')
  updateAnnualSummary(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('year', new ParseIntPipe()) year: number,
    @Body() input: AnnualSummaryUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateAnnualSummary(id, year, input, principal);
  }

  /** M06q: the open request and earlier requests. */
  @Get(':id/grade-requests')
  gradeRequests(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.listGradeRequests(id, principal);
  }

  /** M06g: assigned Society Officer, SPC or DDM. The grade stays until HQ approves. */
  @Post(':id/grade-requests')
  @RequireRoles(
    'SOCIETY_OFFICER',
    'PROGRAMME_COORDINATOR',
    'DEPUTY_DISTRICT_MANAGER',
  )
  requestGradeChange(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: GradeChangeRequestDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.requestGradeChange(id, input, principal);
  }

  /** HQ approves or rejects a waiting request. */
  @Post(':id/grade-requests/:requestId/decision')
  @HttpCode(200)
  @RequireRoles('HQ_ADMIN')
  decideGradeRequest(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body() input: GradeDecisionDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.decideGradeRequest(id, requestId, input, principal);
  }

  /** M06h: every change, with who made it and when. */
  @Get(':id/history')
  history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: SocietyHistoryQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.history(id, query.category, principal);
  }

  /** D05w: the year's planned activities and allocated (planning) costs. */
  @Get(':id/work-plan')
  workPlan(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: WorkPlanQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.workPlan(id, query.year, principal);
  }
}
