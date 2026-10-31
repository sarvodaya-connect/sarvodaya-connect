import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CreateDistrictDelegationDto } from './district-delegations.dto.js';
import { DistrictDelegationsService } from './district-delegations.service.js';

@Controller('district-delegations')
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles('DISTRICT_MANAGER', 'DEPUTY_DISTRICT_MANAGER', 'HQ_ADMIN')
export class DistrictDelegationsController {
  constructor(private readonly service: DistrictDelegationsService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal) {
    return this.service.list(principal);
  }

  @Post()
  @RequireRoles('DISTRICT_MANAGER')
  create(@Body() input: CreateDistrictDelegationDto, @CurrentPrincipal() principal: Principal) {
    return this.service.create(input, principal);
  }

  @Post(':id/revoke')
  @RequireRoles('DISTRICT_MANAGER')
  revoke(@Param('id', new ParseUUIDPipe()) id: string, @CurrentPrincipal() principal: Principal) {
    return this.service.revoke(id, principal);
  }
}
