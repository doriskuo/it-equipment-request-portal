import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { AuthGuard } from '../common/guards/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get('categories')
  async getCategories() {
    return this.equipmentService.getCategories();
  }

  @Get('products')
  async getProducts(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.equipmentService.getProducts(
      categoryId,
      search,
      parseInt(page),
      parseInt(limit),
    );
  }
}
