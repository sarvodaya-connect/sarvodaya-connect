import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ASSISTANT_MODEL, assistantModelFromConfig } from './assistant-model.js';
import { AssistantTools } from './assistant-tools.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';

@Module({
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantTools,
    { provide: ASSISTANT_MODEL, inject: [ConfigService], useFactory: assistantModelFromConfig },
  ],
})
export class AssistantModule {}
