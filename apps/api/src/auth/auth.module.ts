import { NicVaultController } from '../identity/nic-vault.controller.js';
import { NicVaultService } from '../identity/nic-vault.service.js';
import { IdentityService } from '../identity/identity.service.js';
import { DistrictAccessService } from '../identity/district-access.service.js';
import { IdentityController } from '../identity/identity.controller.js';
import { SessionAuthenticationProvider } from '../identity/session-authentication.provider.js';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AUTHENTICATION_PROVIDER } from './authentication-provider.js';
import { AuthenticationGuard } from './authentication.guard.js';
import { DemoAuthenticationProvider } from './demo-authentication.provider.js';
import { RolesGuard } from './roles.guard.js';
import {
  authProviderName,
  CognitoAuthenticationProvider,
  COGNITO_TOKEN_VERIFIER,
  cognitoVerifierFromConfig,
  SUBJECT_PRINCIPAL_LOADER,
} from './cognito-authentication.provider.js';
import { COGNITO_ACCOUNT_ADMIN, cognitoAccountAdminFromConfig, NO_COGNITO_ADMIN } from './cognito-account-admin.js';
import { PlatformUserDirectory, USER_DIRECTORY } from './user-directory.js';

@Global()
@Module({
  controllers: [IdentityController, NicVaultController],
  providers: [
    NicVaultService,
    IdentityService,
    DistrictAccessService,
    SessionAuthenticationProvider,
    AuthenticationGuard,
    RolesGuard,
    DemoAuthenticationProvider,
    // AUTH_PROVIDER picks local sessions (development, tests) or Amazon Cognito
    // (production). Either way roles and scopes come from the database.
    { provide: SUBJECT_PRINCIPAL_LOADER, useExisting: IdentityService },
    {
      provide: COGNITO_TOKEN_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        authProviderName(config) === 'cognito'
          ? cognitoVerifierFromConfig(config)
          : { verify: () => Promise.reject(new Error('Cognito is not selected')) },
    },
    // HQ account creation and password resets in Cognito, with the API's IAM role.
    {
      provide: COGNITO_ACCOUNT_ADMIN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        authProviderName(config) === 'cognito' ? cognitoAccountAdminFromConfig(config) : NO_COGNITO_ADMIN,
    },
    CognitoAuthenticationProvider,
    {
      provide: AUTHENTICATION_PROVIDER,
      inject: [ConfigService, SessionAuthenticationProvider, CognitoAuthenticationProvider],
      useFactory: (
        config: ConfigService,
        session: SessionAuthenticationProvider,
        cognito: CognitoAuthenticationProvider,
      ) => (authProviderName(config) === 'cognito' ? cognito : session),
    },
    { provide: USER_DIRECTORY, useClass: PlatformUserDirectory },
  ],
  exports: [
    NicVaultService,
    DistrictAccessService,
    AuthenticationGuard,
    RolesGuard,
    AUTHENTICATION_PROVIDER,
    USER_DIRECTORY,
  ],
})
export class AuthModule {}
