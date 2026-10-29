import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { CurrentPrincipal } from '../auth/current-principal.decorator.js';
import type { Principal } from '../auth/principal.js';
import { IdentityService } from './identity.service.js';
import {
  ActivateAccountDto,
  ActivationCheckDto,
  GrantDistrictAccessDto,
  InviteAccountDto,
  IssueInvitationDto,
  LoginDto,
} from './identity.dto.js';
@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}
  @Header('Cache-Control', 'no-store')
  @Post('login')
  login(@Body() input: LoginDto) {
    return this.identity.login(input);
  }
  @Header('Cache-Control', 'no-store')
  @Post('activation/check')
  check(@Body() input: ActivationCheckDto) {
    return this.identity.checkActivation(input);
  }
  @Header('Cache-Control', 'no-store')
  @Post('activation/complete')
  activate(@Body() input: ActivateAccountDto) {
    return this.identity.activate(input);
  }
  @Header('Cache-Control', 'no-store')
  @Get('me')
  @UseGuards(AuthenticationGuard)
  me(@CurrentPrincipal() principal: Principal) {
    return principal;
  }
  @Header('Cache-Control', 'no-store')
  @Post('logout')
  @UseGuards(AuthenticationGuard)
  logout(@Req() request: Request) {
    return this.identity.logout(
      request.headers.authorization?.replace(/^Bearer /, '') ?? '',
    );
  }
  @Header('Cache-Control', 'no-store')
  @Get('scope-options')
  @UseGuards(AuthenticationGuard)
  scopeOptions(@CurrentPrincipal() principal: Principal) {
    return this.identity.scopeOptions(principal);
  }
  @Get('accounts')
  @UseGuards(AuthenticationGuard)
  accounts(@CurrentPrincipal() principal: Principal) {
    return this.identity.accounts(principal);
  }
  @Header('Cache-Control', 'no-store')
  @Post('accounts')
  @UseGuards(AuthenticationGuard)
  invite(
    @Body() input: InviteAccountDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.identity.invite(input, principal);
  }
  @Put('accounts/:id') @UseGuards(AuthenticationGuard) update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: InviteAccountDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.identity.updateAccount(id, input, principal);
  }
  @Header('Cache-Control', 'no-store')
  @Post('accounts/:id/disable')
  @UseGuards(AuthenticationGuard)
  disable(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.identity.disableAccount(id, principal);
  }
  @Header('Cache-Control', 'no-store')
  @Post('accounts/:id/invitation')
  @UseGuards(AuthenticationGuard)
  reissue(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: IssueInvitationDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.identity.reissue(id, input.method, principal);
  }
  @Header('Cache-Control', 'no-store')
  @Get('district-deputies')
  @UseGuards(AuthenticationGuard)
  deputies(@CurrentPrincipal() principal: Principal) {
    return this.identity.deputies(principal);
  }
  @Get('district-access') @UseGuards(AuthenticationGuard) grants(
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.identity.grants(principal);
  }
  @Header('Cache-Control', 'no-store')
  @Post('district-access')
  @UseGuards(AuthenticationGuard)
  grant(
    @Body() input: GrantDistrictAccessDto,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.identity.grant(input, principal);
  }
  @Header('Cache-Control', 'no-store')
  @Post('district-access/:id/revoke')
  @UseGuards(AuthenticationGuard)
  revoke(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentPrincipal() principal: Principal,
  ) {
    return this.identity.revoke(id, principal);
  }
  @Header('Cache-Control', 'no-store')
  @Get('audit')
  @UseGuards(AuthenticationGuard)
  audit(@CurrentPrincipal() principal: Principal) {
    return this.identity.audit(principal);
  }
}
