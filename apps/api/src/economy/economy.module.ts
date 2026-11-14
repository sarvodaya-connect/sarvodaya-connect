import { Module } from '@nestjs/common';

import { EconomyController } from './economy.controller.js';
import { EconomyRepository } from './economy.repository.js';
import { EconomyService } from './economy.service.js';

/** Issue #145: Village Economic Profile. */
@Module({
  controllers: [EconomyController],
  providers: [EconomyService, EconomyRepository],
})
export class EconomyModule {}
