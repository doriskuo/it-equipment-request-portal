import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EquipmentService {
  constructor(private prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.equipmentCategory.findMany({
      where: { isActive: true, parentId: null },
      include: {
        children: true,
      },
    });
  }

  async getProducts(
    categoryId?: string,
    search?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const whereClause: any = { isActive: true };
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }
    if (search) {
      whereClause.name = { contains: search };
    }

    const [items, total] = await Promise.all([
      this.prisma.equipmentProduct.findMany({
        where: whereClause,
        include: { category: true },
        skip,
        take: Number(limit),
      }),
      this.prisma.equipmentProduct.count({ where: whereClause }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
