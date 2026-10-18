import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DOCUMENT_STORAGE } from './document-storage.js';
import { LocalStorageController } from './local-storage.controller.js';
import { createDocumentStorage } from './storage.config.js';

@Global()
@Module({
  controllers: [LocalStorageController],
  providers: [
    {
      provide: DOCUMENT_STORAGE,
      useFactory: createDocumentStorage,
      inject: [ConfigService],
    },
  ],
  exports: [DOCUMENT_STORAGE],
})
export class StorageModule {}
