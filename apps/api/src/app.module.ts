import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

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
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
