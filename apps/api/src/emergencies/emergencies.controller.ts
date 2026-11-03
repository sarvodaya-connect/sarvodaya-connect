import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { EMERGENCY_ROLES } from './emergency-access.policy.js';
import {
  AssignHelpersDto,
  CreateActionDto,
  CreateEvidenceDto,
  CreateReportDto,
  IncidentListQueryDto,
  OpenIncidentDto,
  ReportOptionsQueryDto,
  SendAssessmentDto,
  SocietyListQueryDto,
  UpdateDeliveryDto,
} from './emergency.dto.js';
import { EmergenciesService } from './emergencies.service.js';

const uuid = new ParseUUIDPipe();

/**
 * V5 PR 8: disaster response. Every role reaches these endpoints; the service
 * checks each request against the user's own societies or district, and only
 * HQ assigns response actions or makes situation reports.
 */
@Controller('emergencies')
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles(...EMERGENCY_ROLES)
export class EmergenciesController {
  constructor(private readonly service: EmergenciesService) {}

  @Get('incidents')
  list(
    @Query() query: IncidentListQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.list(principal, query.status);
  }

  @Get('report-options')
  reportOptions(
    @Query() query: ReportOptionsQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.reportOptions(principal, query.search);
  }

  @Post('incidents')
  open(
    @Body() input: OpenIncidentDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.open(input, principal);
  }

  @Get('incidents/:id')
  details(
    @Param('id', uuid) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.details(id, principal);
  }

  @Get('incidents/:id/societies')
  societies(
    @Param('id', uuid) id: string,
    @Query() query: SocietyListQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.societies(id, query, principal);
  }

  @Get('incidents/:id/societies/:societyId')
  society(
    @Param('id', uuid) id: string,
    @Param('societyId', uuid) societyId: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.society(id, societyId, principal);
  }

  /** Sent online only; a retry with the same clientMutationId returns the same update. */
  @Post('incidents/:id/assessments')
  sendAssessment(
    @Param('id', uuid) id: string,
    @Body() input: SendAssessmentDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.sendAssessment(id, input, principal);
  }

  @Post('incidents/:id/close')
  close(
    @Param('id', uuid) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.close(id, principal);
  }

  @Post('incidents/:id/reminders')
  @RequireRoles('HQ_ADMIN')
  remind(
    @Param('id', uuid) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.remind(id, principal);
  }

  @Post('incidents/:id/actions')
  @RequireRoles('HQ_ADMIN')
  createAction(
    @Param('id', uuid) id: string,
    @Body() input: CreateActionDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createAction(id, input, principal);
  }

  @Get('actions/:id/candidates')
  @RequireRoles('HQ_ADMIN')
  candidates(
    @Param('id', uuid) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.helpingCandidates(id, principal);
  }

  @Post('actions/:id/helpers')
  @RequireRoles('HQ_ADMIN')
  assignHelpers(
    @Param('id', uuid) id: string,
    @Body() input: AssignHelpersDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.assignHelpers(id, input, principal);
  }

  @Patch('helpers/:id')
  updateDelivery(
    @Param('id', uuid) id: string,
    @Body() input: UpdateDeliveryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateDelivery(id, input, principal);
  }

  @Post('incidents/:id/situation-reports')
  @RequireRoles('HQ_ADMIN')
  createReport(
    @Param('id', uuid) id: string,
    @Body() input: CreateReportDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.createReport(id, input, principal);
  }

  @Get('situation-reports/:id')
  report(
    @Param('id', uuid) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.report(id, principal);
  }

  @Post('assessments/:id/evidence')
  assessmentEvidence(
    @Param('id', uuid) id: string,
    @Body() input: CreateEvidenceDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.assessmentEvidence(id, input, principal);
  }

  @Post('helpers/:id/evidence')
  deliveryEvidence(
    @Param('id', uuid) id: string,
    @Body() input: CreateEvidenceDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.deliveryEvidence(id, input, principal);
  }

  @Post('evidence/:id/complete')
  completeEvidence(
    @Param('id', uuid) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.completeEvidence(id, principal);
  }

  @Post('evidence/:id/download')
  downloadEvidence(
    @Param('id', uuid) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.downloadEvidence(id, principal);
  }
}
