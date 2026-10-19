import type { Request } from 'express';

import type { Principal } from './principal.js';

/** Identity verification boundary. A Cognito adapter can replace the demo
 * implementation without changing controllers or application services. */
export interface AuthenticationProvider {
  authenticate(request: Request): Promise<Principal | null>;
}

export const AUTHENTICATION_PROVIDER = Symbol('AUTHENTICATION_PROVIDER');

export type AuthenticatedRequest = Request & { principal?: Principal };
