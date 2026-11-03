import { Module } from '@nestjs/common';

import { DocumentsModule } from '../documents/documents.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DirectoryRepository } from './directory.repository.js';
import { DirectoryService } from './directory.service.js';
import {
  DirectoryController,
  NationalController,
} from './national.controller.js';
import { NationalRepository } from './national.repository.js';
import { NationalService } from './national.service.js';
import { ReportsService } from './reports.service.js';
import { RequestsService } from './requests.service.js';
import { SearchService } from './search.service.js';

/** V5 PR 5: the HQ National Dashboard, its drill-downs, directory, search, requests and reports. */
@Module({
  imports: [DocumentsModule, NotificationsModule],
  controllers: [NationalController, DirectoryController],
  providers: [
    NationalRepository,
    NationalService,
    DirectoryRepository,
    DirectoryService,
    SearchService,
    RequestsService,
    ReportsService,
  ],
})
export class NationalModule {}
