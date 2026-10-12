import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication<App> | undefined;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication<App>();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('GET /api/v1/health', async () => {
    if (!app) {
      throw new Error('Test application was not initialized');
    }

    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'sarvodaya-connect-api',
      });
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });
});
