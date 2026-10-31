import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { GradeChangeDecisionDto, GradeChangeQueryDto } from './dto/grade-change.dto.js';
import { GradeChangesService } from './grade-changes.service.js';

@Controller('grade-changes')
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles('HQ_ADMIN')
export class GradeChangesController {
  constructor(private readonly service: GradeChangesService) {}

  @Get()
  list(@Query() query: GradeChangeQueryDto, @CurrentPrincipal() principal: Principal) {
    return this.service.list(query, principal);
  }

  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe()) id: string, @CurrentPrincipal() principal: Principal) {
    return this.service.getById(id, principal);
  }

  @Post(':id/decision')
  @RequireRoles('HQ_ADMIN')
  decide(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: GradeChangeDecisionDto, @CurrentPrincipal() principal: Principal) {
    return this.service.decide(id, input, principal);
  }
}
