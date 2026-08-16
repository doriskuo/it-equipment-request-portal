import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userEmail = request.headers['x-user-email'];

    if (!userEmail) {
      throw new UnauthorizedException(
        'Missing x-user-email header for mock auth',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: userEmail as string },
      include: {
        department: true,
        roles: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Mock user not found');
    }

    // Attach user to request context
    request.user = user;
    return true;
  }
}

// User Decorator for easy access
import { createParamDecorator } from '@nestjs/common';
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
