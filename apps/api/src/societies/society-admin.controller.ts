import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AssignStaffDto, CreateSocietyDto } from './dto/society-admin.dto.js';
import { SocietyAdminService } from './society-admin.service.js';

/** V5 D05a assignments and D05n/D05c new societies. HQ only. */
@Controller('societies')
@UseGuards(AuthenticationGuard, RolesGuard)
export class SocietyAdminController {
  constructor(private readonly service: SocietyAdminService) {}

  @Post()
  @RequireRoles('HQ_ADMIN')
  create(
    @Body() input: CreateSocietyDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.create(input, principal);
  }

  @Get(':id/staff-options')
  @RequireRoles('HQ_ADMIN')
  @Header('Cache-Control', 'no-store')
  staffOptions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.staffOptions(id, principal);
  }

  @Put(':id/assignments')
  @RequireRoles('HQ_ADMIN')
  assign(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: AssignStaffDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.assign(id, input, principal);
  }
}
