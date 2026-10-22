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
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import type { Principal } from '../auth/principal.js';
import { ActivitiesService } from './activities.service.js';
import { ActivityInputDto, ActivityQueryDto } from './dto/activity.dto.js';

@Controller('activities')
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles('SOCIETY_OFFICER', 'DISTRICT_MANAGER', 'HQ_ADMIN')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}
  @Post() create(
    @Body() input: ActivityInputDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.create(input, principal);
  }
  @Post('submit') createAndSubmit(
    @Body() input: ActivityInputDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.create(input, principal, true);
  }
  @Get() list(
    @Query() query: ActivityQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.list(query, principal);
  }
  @Get('summary') summary(
    @Query() query: ActivityQueryDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.summary(query, principal);
  }
  @Get(':id') detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.detail(id, principal);
  }
  @Patch(':id/draft') saveDraft(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ActivityInputDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.saveDraft(id, input, principal);
  }
  @Post(':id/submit') submit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.submit(id, principal);
  }
}
