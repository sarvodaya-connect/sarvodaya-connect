import { Global, Module } from '@nestjs/common';

import { AUTHENTICATION_PROVIDER } from './authentication-provider.js';
import { AuthenticationGuard } from './authentication.guard.js';
import { DemoAuthenticationProvider } from './demo-authentication.provider.js';
import { RolesGuard } from './roles.guard.js';
import { DemoUserDirectory, USER_DIRECTORY } from './user-directory.js';

@Global()
@Module({
  providers: [
    AuthenticationGuard,
    RolesGuard,
    DemoAuthenticationProvider,
    {
      provide: AUTHENTICATION_PROVIDER,
      useExisting: DemoAuthenticationProvider,
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
