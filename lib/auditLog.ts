import { createAuditLog as writeAuditLog, type AuditLogClient, type AuditLogInput } from "../apps/api/src/common/audit-log";
import { prisma } from "@/lib/prisma";

export type { AuditLogInput };

export function createAuditLog(input: AuditLogInput, client: AuditLogClient = prisma) {
  return writeAuditLog(input, client);
}
