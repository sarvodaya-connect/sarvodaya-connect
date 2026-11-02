import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { RequireRoles } from '../auth/require-roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AskAssistantDto } from './assistant.dto.js';
import { AssistantService } from './assistant.service.js';

/** SarvoAI is HQ-only; other roles get 403 before any data or model is touched. */
@Controller('assistant')
@UseGuards(AuthenticationGuard, RolesGuard)
@RequireRoles('HQ_ADMIN')
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Post('questions')
  @HttpCode(200)
  ask(@Body() input: AskAssistantDto, @CurrentPrincipal() principal: Principal) {
    return this.service.ask(principal, input.question, input.history);
  }
}
