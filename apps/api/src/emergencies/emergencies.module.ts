import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { EmergenciesController } from './emergencies.controller.js';
import { EmergenciesRepository } from './emergencies.repository.js';
import { EmergenciesService } from './emergencies.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [EmergenciesController],
  providers: [EmergenciesService, EmergenciesRepository],
})
export class EmergenciesModule {}
