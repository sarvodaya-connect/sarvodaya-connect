import { Global, Module } from '@nestjs/common';

import { DemoAuthGuard } from './demo-auth.guard.js';
import { DemoUserDirectory, USER_DIRECTORY } from './user-directory.js';

@Global()
@Module({
  providers: [
    DemoAuthGuard,
    { provide: USER_DIRECTORY, useClass: DemoUserDirectory },
  ],
  exports: [DemoAuthGuard, USER_DIRECTORY],
})
export class AuthModule {}
