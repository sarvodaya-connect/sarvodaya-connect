import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module.js';

import { HomeController } from './home.controller.js';
import { HomeService } from './home.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
