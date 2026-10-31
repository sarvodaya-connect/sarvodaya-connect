
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { DistrictsService } from './districts.service.js';

@Controller('districts')
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles('SOCIETY_OFFICER', 'PROGRAMME_COORDINATOR', 'DISTRICT_MANAGER', 'DEPUTY_DISTRICT_MANAGER', 'HQ_ADMIN')
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}

  @Get()
  list(@CurrentPrincipal() principal: Principal) {
    return this.districtsService.list(principal);
  }
}
