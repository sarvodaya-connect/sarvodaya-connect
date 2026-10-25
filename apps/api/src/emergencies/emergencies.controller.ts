import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ActivateIncidentDto, CreateResponseActionDto, SyncAssessmentDto, SyncSituationReportDto, UpdateIncidentStatusDto, UpdateResponseActionStatusDto } from './emergency.dto.js';
import { EmergenciesService } from './emergencies.service.js';

@Controller('emergencies')
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles('SOCIETY_OFFICER', 'PROGRAMME_COORDINATOR', 'DISTRICT_MANAGER', 'HQ_ADMIN')
export class EmergenciesController {
  constructor(private readonly service: EmergenciesService) {}

  @Get('incidents')
  list(@CurrentPrincipal() principal: Principal) {
    return this.service.list(principal);
  }

  @Post('incidents')
  @RequireRoles('DISTRICT_MANAGER', 'HQ_ADMIN')
  activate(@Body() input: ActivateIncidentDto, @CurrentPrincipal() principal: Principal) {
    return this.service.activate(input, principal);
  }

  @Patch('incidents/:id/status')
  @RequireRoles('DISTRICT_MANAGER', 'HQ_ADMIN')
  updateIncidentStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateIncidentStatusDto, @CurrentPrincipal() principal: Principal) {
    return this.service.updateIncidentStatus(id, input.status, principal);
  }

  @Get('incidents/:id')
  details(@Param('id', new ParseUUIDPipe()) id: string, @CurrentPrincipal() principal: Principal) {
    return this.service.details(id, principal);
  }

  /** Offline clients retry the same clientMutationId; the API returns one durable record. */
  @Post('assessments/sync')
  syncAssessment(@Body() input: SyncAssessmentDto, @CurrentPrincipal() principal: Principal) {
    return this.service.assessment(input, principal);
  }

  @Post('actions')
  @RequireRoles('PROGRAMME_COORDINATOR', 'DISTRICT_MANAGER', 'HQ_ADMIN')
  createAction(@Body() input: CreateResponseActionDto, @CurrentPrincipal() principal: Principal) {
    return this.service.createAction(input, principal);
  }

  @Patch('actions/:id/status')
  @RequireRoles('DISTRICT_MANAGER', 'HQ_ADMIN')
  updateActionStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateResponseActionStatusDto, @CurrentPrincipal() principal: Principal) {
    return this.service.updateActionStatus(id, input.status, principal);
  }

  @Post('situation-reports/sync')
  syncSituationReport(@Body() input: SyncSituationReportDto, @CurrentPrincipal() principal: Principal) {
    return this.service.situationReport(input, principal);
  }
}
