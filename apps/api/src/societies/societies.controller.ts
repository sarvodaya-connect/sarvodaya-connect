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
import { DemoAuthGuard } from '../auth/demo-auth.guard.js';
import type { Principal } from '../auth/principal.js';
import { SocietyQueryDto } from './dto/society-query.dto.js';
import {
  MembershipQueryDto,
  SocietyCouncilUpdateDto,
  SocietyMembershipUpdateDto,
  SocietyProfileUpdateDto,
} from './dto/society-updates.dto.js';
import { SocietiesService } from './societies.service.js';

@Controller('societies')
export class SocietiesController {
  constructor(private readonly service: SocietiesService) {}

  @Get()
  list(@Query() query: SocietyQueryDto) {
    return this.service.list(query);
  }

  @Get('membership')
  @UseGuards(DemoAuthGuard)
  membership(
    @Query() query: MembershipQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.membership(query.year, principal);
  }

  @Patch(':id/profile')
  @UseGuards(DemoAuthGuard)
  updateProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SocietyProfileUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateProfile(id, input, principal);
  }

  @Put(':id/profile')
  @UseGuards(DemoAuthGuard)
  createOrReplaceProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SocietyProfileUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateProfile(id, input, principal);
  }

  @Put(':id/council')
  @UseGuards(DemoAuthGuard)
  updateCouncil(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SocietyCouncilUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateCouncil(id, input, principal);
  }

  @Put(':id/membership')
  @UseGuards(DemoAuthGuard)
  updateMembership(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: SocietyMembershipUpdateDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.updateMembership(id, input, principal);
  }

  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getById(id);
  }
}
