import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditLogClient = Pick<typeof prisma, "auditLog">;

export type AuditLogInput = {
  hotelId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditLog(
  input: AuditLogInput,
  client: AuditLogClient = prisma,
) {
  return client.auditLog.create({
    data: {
      hotelId: input.hotelId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? undefined,
    },
  });
}
