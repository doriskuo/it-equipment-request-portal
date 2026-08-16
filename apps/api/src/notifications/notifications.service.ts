import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcurementStatus, RoleType, NotificationType } from '@prisma/client';

const STATUS_ZH_MAP: Record<ProcurementStatus, string> = {
  DRAFT: '草稿',
  PENDING_DEPARTMENT_MANAGER_APPROVAL: '待部門主管審核',
  PENDING_SENIOR_MANAGER_APPROVAL: '待高階主管審核',
  PENDING_IT_REVIEW: '待 IT 評估',
  PENDING_PROCUREMENT: '待採購處理',
  PROCUREMENT_IN_PROGRESS: '採購處理中',
  PENDING_ACCOUNTING_CONFIRMATION: '待會計確認',
  PENDING_DELIVERY: '設備交付中',
  PENDING_RECEIPT_CONFIRMATION: '待申請人驗收',
  COMPLETED: '已結案',
  RETURNED_TO_REQUESTER: '已退回給申請人',
  REJECTED: '已駁回',
  CANCELLED: '已取消',
};

const ROLE_ZH_MAP: Record<RoleType, string> = {
  EMPLOYEE: '一般員工',
  MANAGER: '部門主管',
  IT: 'IT 部門',
  PROCUREMENT: '採購部門',
  ACCOUNTING: '會計部門',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Called whenever a request changes state to notify the requester and the next handler(s).
   */
  async notifyStateChange(
    requestId: string,
    fromStatus: ProcurementStatus,
    toStatus: ProcurementStatus,
    requesterId: string,
    currentAssigneeId: string | null,
    currentHandlerRole: RoleType | null,
  ) {
    if (fromStatus === toStatus) return; // No state change

    const request = await this.prisma.procurementRequest.findUnique({
      where: { id: requestId },
      select: { requestNumber: true },
    });
    if (!request) return;

    // 1. Always notify the requester (INFO)
    await this.prisma.notification.create({
      data: {
        userId: requesterId,
        requestId: requestId,
        title: `您的申請單狀態已更新`,
        message: `單號 ${request.requestNumber} 的狀態已變更為「${STATUS_ZH_MAP[toStatus]}」`,
        type: NotificationType.INFO,
      },
    });

    // 2. Notify the next handler(s) (ACTION_REQUIRED)
    if (currentAssigneeId) {
      // Notify specific assignee
      if (
        currentAssigneeId !== requesterId ||
        toStatus === 'RETURNED_TO_REQUESTER'
      ) {
        await this.prisma.notification.create({
          data: {
            userId: currentAssigneeId,
            requestId: requestId,
            title: `待處理單據通知`,
            message: `單號 ${request.requestNumber} 需要您的處理`,
            type: NotificationType.ACTION_REQUIRED,
          },
        });
      }
    } else if (currentHandlerRole) {
      // Broadcast to all users with the specific role
      const usersWithRole = await this.prisma.userRole.findMany({
        where: { role: currentHandlerRole },
        select: { userId: true },
      });

      const notificationsToCreate = usersWithRole.map((ur) => ({
        userId: ur.userId,
        requestId: requestId,
        title: `新單據待處理 (${ROLE_ZH_MAP[currentHandlerRole] || currentHandlerRole})`,
        message: `單號 ${request.requestNumber} 已進入「${STATUS_ZH_MAP[toStatus]}」階段，需要您的處理`,
        type: NotificationType.ACTION_REQUIRED,
      }));

      if (notificationsToCreate.length > 0) {
        await this.prisma.notification.createMany({
          data: notificationsToCreate,
        });
      }
    }

    // 3. Stub for future Email Notification extension
    // TODO: Send Email (Future Extensibility)
    // this.emailService.sendStatusUpdateEmail(requesterEmail, request.requestNumber, toStatus);
    // this.emailService.sendActionRequiredEmail(assigneeEmail, request.requestNumber);
    this.logger.debug(
      `[Hooks] Notifications generated for state change: ${fromStatus} -> ${toStatus}`,
    );
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async getMyNotifications(userId: string, limit: number = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        request: {
          select: { requestNumber: true },
        },
      },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
