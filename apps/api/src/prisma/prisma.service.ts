import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL')?.trim();

    if (!url) {
      throw new Error('DATABASE_URL is required');
    }

    const max = Number(config.get<string>('DATABASE_CONNECTION_LIMIT') ?? 2);
    if (!Number.isInteger(max) || max < 1 || max > 20)
      throw new Error('DATABASE_CONNECTION_LIMIT must be between 1 and 20');
    super({
      adapter: new PrismaPg({
        connectionString: url,
        max,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
