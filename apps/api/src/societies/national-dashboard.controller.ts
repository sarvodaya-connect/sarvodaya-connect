import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SocietiesService } from './societies.service.js';

@Controller('dashboard')
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles('HQ_ADMIN')
export class NationalDashboardController {
  constructor(private readonly societies: SocietiesService) {}

  @Get('national-overview')
  overview(@CurrentPrincipal() principal: Principal) {
    return this.societies.nationalOverview(principal);
  }
}
