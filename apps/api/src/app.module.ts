
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { DistrictsController } from './districts/districts.controller.js';
import { SocietiesController } from './societies/societies.controller.js';
import { SocietiesService } from './societies/societies.service.js';
import { SocietiesRepository } from './societies/societies.repository.js';
import { DistrictsService } from './districts/districts.service.js';

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
  ],
  controllers: [
    AppController,
    DistrictsController,
    SocietiesController,
  ],
  providers: [
    AppService,
    PrismaService,
    SocietiesService,
    SocietiesRepository,
    DistrictsService,
  ],
})
export class AppModule {}
