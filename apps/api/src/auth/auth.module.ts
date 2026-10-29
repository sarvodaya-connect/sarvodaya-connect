import { NicVaultController } from '../identity/nic-vault.controller.js';
import { NicVaultService } from '../identity/nic-vault.service.js';
import { IdentityService } from '../identity/identity.service.js';
import { IdentityController } from '../identity/identity.controller.js';
import { SessionAuthenticationProvider } from '../identity/session-authentication.provider.js';
import { Global, Module } from '@nestjs/common';

import { AUTHENTICATION_PROVIDER } from './authentication-provider.js';
import { AuthenticationGuard } from './authentication.guard.js';
import { DemoAuthenticationProvider } from './demo-authentication.provider.js';
import { RolesGuard } from './roles.guard.js';
import { DemoUserDirectory, USER_DIRECTORY } from './user-directory.js';

@Global()
@Module({
  controllers: [IdentityController, NicVaultController],
  providers: [
    NicVaultService,
    IdentityService,
    SessionAuthenticationProvider,
    AuthenticationGuard,
    RolesGuard,
    DemoAuthenticationProvider,
    {
      provide: AUTHENTICATION_PROVIDER,
      useExisting: SessionAuthenticationProvider,
    },
    { provide: USER_DIRECTORY, useClass: DemoUserDirectory },
  ],
  exports: [
    AuthenticationGuard,
    RolesGuard,
    AUTHENTICATION_PROVIDER,
    USER_DIRECTORY,
  ],
})
export class AuthModule {}
