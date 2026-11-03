import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { DistrictsService } from './districts.service.js';

/** District names and society counts, for signed-in users only (V5 PR 10 security audit). */
@Controller('districts')
@UseGuards(AuthenticationGuard)
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}

  @Get()
  list() {
    return this.districtsService.list();
  }
}
