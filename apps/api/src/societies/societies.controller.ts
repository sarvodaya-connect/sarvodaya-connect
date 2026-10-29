import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { SocietyQueryDto } from './dto/society-query.dto.js';
import {
  MembershipQueryDto,
  SocietyCouncilUpdateDto,
  SocietyMembershipUpdateDto,
  SocietyProfileUpdateDto,
} from './dto/society-updates.dto.js';
import { SocietiesService } from './societies.service.js';

@Controller('societies')
@UseGuards(AuthenticationGuard, RolesGuard)
export class SocietiesController {
  constructor(private readonly service: SocietiesService) {}

  @Get()
  list(@Query() query: SocietyQueryDto, @CurrentPrincipal() principal: Principal) {
    return this.service.list(query, principal);
  }

  @Get('membership')
  @UseGuards(AuthenticationGuard, RolesGuard)
  membership(
    @Query() query: MembershipQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.membership(query.year, principal);
  }

  @Patch(':id/profile')
  @UseGuards(AuthenticationGuard, RolesGuard)
  @RequireRoles('SOCIETY_OFFICER', 'PROGRAMME_COORDINATOR', 'HQ_ADMIN')
  updateProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SocietyProfileUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateProfile(id, input, principal);
  }

  @Put(':id/profile')
  @UseGuards(AuthenticationGuard, RolesGuard)
  @RequireRoles('SOCIETY_OFFICER', 'PROGRAMME_COORDINATOR', 'HQ_ADMIN')
  createOrReplaceProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SocietyProfileUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateProfile(id, input, principal);
  }

  @Put(':id/council')
  @UseGuards(AuthenticationGuard, RolesGuard)
  @RequireRoles('SOCIETY_OFFICER', 'PROGRAMME_COORDINATOR', 'HQ_ADMIN')
  updateCouncil(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SocietyCouncilUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateCouncil(id, input, principal);
  }

  @Put(':id/membership')
  @UseGuards(AuthenticationGuard, RolesGuard)
  @RequireRoles('SOCIETY_OFFICER', 'PROGRAMME_COORDINATOR', 'HQ_ADMIN')
  updateMembership(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SocietyMembershipUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateMembership(id, input, principal);
  }

  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe()) id: string, @CurrentPrincipal() principal: Principal) {
    return this.service.getById(id, principal);
  }
}
