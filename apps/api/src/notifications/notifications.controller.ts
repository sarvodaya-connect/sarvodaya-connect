import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { Principal } from '../auth/principal.js';
import { NotificationQueryDto } from './dto/notification-query.dto.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(AuthenticationGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: NotificationQueryDto,
  ) {
    return this.service.list(principal, query);
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentPrincipal() principal: Principal) {
    return this.service.markAllRead(principal);
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.markRead(principal, id);
  }
}
