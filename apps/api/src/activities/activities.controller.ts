import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import {
  ActivityInputDto,
  ApproveActivityDto,
  SendBackActivityDto,
} from './activities.dto.js';
import { ActivitiesService } from './activities.service.js';

/**
 * V5 PR 4 activity endpoints (M09a–M09d, SP06–SP08, M50–M52). Every handler
 * checks the society scope and the role rule on the server.
 */
@Controller()
@UseGuards(AuthenticationGuard, RolesGuard)
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  /** M09a–M09d: add an activity to the work plan; it waits for the SPC. */
  @Post('societies/:id/activities')
  create(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ActivityInputDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.create(id, input, principal);
  }

  /** Change an activity that is waiting or was sent back. */
  @Put('societies/:id/activities/:activityId')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @Body() input: ActivityInputDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.update(id, activityId, input, principal);
  }

  /** SP06 / M50: SPC only. */
  @Get('activity-reviews')
  @RequireRoles('PROGRAMME_COORDINATOR')
  queue(@CurrentPrincipal() principal: Principal) {
    return this.service.queue(principal);
  }

  @Get('activities/:activityId')
  get(
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.get(activityId, principal);
  }

  /** SP07 / M51: the assigned SPC approves with at least one UN SDG. */
  @Post('activities/:activityId/approve')
  @HttpCode(200)
  @RequireRoles('PROGRAMME_COORDINATOR')
  approve(
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @Body() input: ApproveActivityDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.approve(activityId, input, principal);
  }

  /** M51b: the assigned SPC sends it back to the Society Officer. */
  @Post('activities/:activityId/send-back')
  @HttpCode(200)
  @RequireRoles('PROGRAMME_COORDINATOR')
  sendBack(
    @Param('activityId', new ParseUUIDPipe()) activityId: string,
    @Body() input: SendBackActivityDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.service.sendBack(activityId, input, principal);
  }
}
