import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('api/notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(@Request() req: any, @Query('limit') limit: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const notifications = await this.notificationsService.getMyNotifications(
      req.user.id,
      parsedLimit,
    );
    const unreadCount = await this.notificationsService.getUnreadCount(
      req.user.id,
    );
    return {
      notifications,
      unreadCount,
    };
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req: any) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { success: true };
  }

  @Patch(':id/read')
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    await this.notificationsService.markAsRead(req.user.id, id);
    return { success: true };
  }
}
