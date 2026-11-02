import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { ActivitiesController } from './activities.controller.js';
import { ActivitiesRepository } from './activities.repository.js';
import { ActivitiesService } from './activities.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivitiesRepository],
  exports: [ActivitiesRepository],
})
export class ActivitiesModule {}
