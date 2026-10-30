import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticationProvider } from '../auth/authentication-provider.js';
import { DemoAuthenticationProvider } from '../auth/demo-authentication.provider.js';
import { IdentityService } from './identity.service.js';
@Injectable()
export class SessionAuthenticationProvider implements AuthenticationProvider {
  constructor(
    private readonly identity: IdentityService,
    private readonly demo: DemoAuthenticationProvider,
  ) {}
  async authenticate(request: Request) {
    const token = request.headers.authorization?.match(
      /^Bearer ([A-Za-z0-9_-]+)$/,
    )?.[1];
    if (token) return this.identity.authenticate(token);
    return this.demo.authenticate(request);
  }
}
