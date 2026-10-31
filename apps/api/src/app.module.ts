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
import { DistrictsService } from './districts/districts.service.js';
import { EmergenciesModule } from './emergencies/emergencies.module.js';
import { GradeChangesController } from './societies/grade-changes.controller.js';
import { GradeChangesService } from './societies/grade-changes.service.js';
import { DistrictDelegationsController } from './districts/district-delegations.controller.js';
import { DistrictDelegationsService } from './districts/district-delegations.service.js';
import { NationalDashboardController } from './societies/national-dashboard.controller.js';

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
  ],
  controllers: [AppController, DistrictsController, DistrictDelegationsController, SocietiesController, GradeChangesController, NationalDashboardController],
  providers: [
    AppService,
    SocietiesService,
    SocietiesRepository,
    GradeChangesService,
    DistrictDelegationsService,
    DistrictsService,
  ],
})
export class AppModule {}
