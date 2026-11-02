import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsRepository } from './documents.repository.js';
import { DocumentsService } from './documents.service.js';
import { RegistrarDocumentsController } from './registrar-documents.controller.js';
import { RegistrarDocumentsRepository } from './registrar-documents.repository.js';
import { RegistrarDocumentsService } from './registrar-documents.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [DocumentsController, RegistrarDocumentsController],
  providers: [
    DocumentsService,
    DocumentsRepository,
    RegistrarDocumentsService,
    RegistrarDocumentsRepository,
  ],
})
export class DocumentsModule {}
