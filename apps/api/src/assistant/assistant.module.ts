import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ASSISTANT_MODEL, assistantModelFromConfig } from './assistant-model.js';
import { AssistantSpendingService } from './assistant-spending.service.js';
import { AssistantTools } from './assistant-tools.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';

@Module({
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantSpendingService,
    AssistantTools,
    { provide: ASSISTANT_MODEL, inject: [ConfigService], useFactory: assistantModelFromConfig },
  ],
})
export class AssistantModule {}
