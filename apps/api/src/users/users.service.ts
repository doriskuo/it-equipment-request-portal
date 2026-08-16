import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAllMockUsers() {
    return this.prisma.user.findMany({
      include: {
        department: true,
        roles: true,
        manager: {
          select: { name: true },
        },
      },
    });
  }
}
