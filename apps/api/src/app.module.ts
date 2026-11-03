import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { StorageModule } from './storage/storage.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { DistrictsController } from './districts/districts.controller.js';
import { SocietiesController } from './societies/societies.controller.js';
import { SocietiesService } from './societies/societies.service.js';
import { SocietiesRepository } from './societies/societies.repository.js';
import { GradeQueueController } from './societies/grade-queue.controller.js';
import { GradeQueueService } from './societies/grade-queue.service.js';
import { SocietyAdminController } from './societies/society-admin.controller.js';
import { SocietyAdminService } from './societies/society-admin.service.js';
import { SocietyRecordController } from './societies/society-record.controller.js';
import { SocietyRecordRepository } from './societies/society-record.repository.js';
import { SocietyRecordService } from './societies/society-record.service.js';
import { DistrictsService } from './districts/districts.service.js';
import { EmergenciesModule } from './emergencies/emergencies.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { NationalModule } from './national/national.module.js';
import { HomeModule } from './home/home.module.js';

const repositoryEnvironmentFile = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.env',
);

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: repositoryEnvironmentFile,
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    StorageModule,
    NotificationsModule,
    DocumentsModule,
    EmergenciesModule,
    AssistantModule,
    ActivitiesModule,
    NationalModule,
    HomeModule,
  ],
  controllers: [
    AppController,
    DistrictsController,
    SocietiesController,
    SocietyRecordController,
    SocietyAdminController,
    GradeQueueController,
  ],
  providers: [
    AppService,
    SocietiesService,
    SocietiesRepository,
    SocietyRecordService,
    SocietyRecordRepository,
    SocietyAdminService,
    GradeQueueService,
    DistrictsService,
  ],
})
export class AppModule {}
