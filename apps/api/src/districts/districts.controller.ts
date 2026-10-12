
import { Controller, Get } from '@nestjs/common';
import { DistrictsService } from './districts.service.js';

@Controller('districts')
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}

  @Get()
  list() {
    return this.districtsService.list();
  }
}
