import {
  Body,
  Controller,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Matches } from 'class-validator';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { NicVaultService } from './nic-vault.service.js';
class SetNicDto {
  @Matches(/^(?:[0-9]{9}[vVxX]|[0-9]{12})$/) nic: string;
}
@Controller('societies/:societyId/council/:memberId/nic')
@UseGuards(AuthenticationGuard)
export class NicVaultController {
  constructor(private readonly vault: NicVaultService) {}
  @Put() @Header('Cache-Control', 'no-store') set(
    @Param('societyId', new ParseUUIDPipe()) societyId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() input: SetNicDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.vault.set(societyId, memberId, input.nic, principal);
  }
  @Post('reveal') @Header('Cache-Control', 'no-store') reveal(
    @Param('societyId', new ParseUUIDPipe()) societyId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.vault.reveal(societyId, memberId, principal);
  }
}
