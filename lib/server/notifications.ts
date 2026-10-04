import "server-only";

import { Prisma, NotificationType } from "@prisma/client";

export type NotificationInput = {
  type?: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  href?: string;
};

export async function createNotification(tx: Prisma.TransactionClient, companyId: string, userId: string, input: NotificationInput) {
  return tx.notification.create({ data: { companyId, userId, type: input.type ?? "INFO", title: input.title, message: input.message, entityType: input.entityType, entityId: input.entityId, href: input.href } });
}
