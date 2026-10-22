import { Module } from '@nestjs/common';
import { EmergenciesController } from './emergencies.controller.js';
import { EmergenciesService } from './emergencies.service.js';

@Module({
  controllers: [EmergenciesController],
  providers: [EmergenciesService],
})
export class EmergenciesModule {}
