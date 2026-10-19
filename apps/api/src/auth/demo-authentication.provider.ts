import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { AuthenticationProvider } from './authentication-provider.js';
import { findDemoPrincipal } from './demo-principals.js';
import type { Principal } from './principal.js';

export const DEMO_USER_HEADER = 'x-demo-user';

/** Fictional X-Demo-User identities; never enabled in production or an
 * unspecified environment. Replace the DI binding with Cognito when ready. */
@Injectable()
export class DemoAuthenticationProvider implements AuthenticationProvider {
  constructor(private readonly config: ConfigService) {}

  async authenticate(request: Request): Promise<Principal | null> {
    const environment = this.config.get<string>('NODE_ENV');
    if (environment !== 'development' && environment !== 'test') return null;

    const header = request.headers[DEMO_USER_HEADER];
    return typeof header === 'string'
      ? (findDemoPrincipal(header.trim()) ?? null)
      : null;
  }
}
