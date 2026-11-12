import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import {
  HomeAuditsQueryDto,
  HomeMembershipQueryDto,
  HomeSocietyQueryDto,
} from './home.dto.js';
import { HomeService } from './home.service.js';

/** V5 PR 6: the desktop home for SPCs (SP01), DDMs (DD01) and DMs (DM01). */
@Controller('home')
@UseGuards(AuthenticationGuard, RolesGuard)
export class HomeController {
  constructor(private readonly service: HomeService) {}

  @Get()
  @RequireRoles(
    'PROGRAMME_COORDINATOR',
    'DEPUTY_DISTRICT_MANAGER',
    'DISTRICT_MANAGER',
  )
  summary(@CurrentPrincipal() principal: Principal) {
    return this.service.summary(principal);
  }

  /** SP02 / DD03 / DM02: assigned societies, or the DM's district (view only). */
  @Get('societies')
  @RequireRoles(
    'PROGRAMME_COORDINATOR',
    'DEPUTY_DISTRICT_MANAGER',
    'DISTRICT_MANAGER',
  )
  societies(
    @Query() query: HomeSocietyQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.societies(principal, query);
  }

  /** Issue #118: the D08 Membership figures for the user's own societies. */
  @Get('membership')
  @RequireRoles(
    'PROGRAMME_COORDINATOR',
    'DEPUTY_DISTRICT_MANAGER',
    'DISTRICT_MANAGER',
  )
  membership(
    @Query() query: HomeMembershipQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.membership(principal, query.scope);
  }

  /** Issue #119: D11 Audits & AGM for the user's own societies. */
  @Get('audits')
  @RequireRoles(
    'PROGRAMME_COORDINATOR',
    'DEPUTY_DISTRICT_MANAGER',
    'DISTRICT_MANAGER',
  )
  audits(
    @Query() query: HomeAuditsQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.audits(principal, {
      scope: query.scope,
      year: query.year,
      page: query.page,
      pageSize: 20,
    });
  }
}
