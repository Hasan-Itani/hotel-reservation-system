"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  AUDIT_EVENT_CATEGORY_OPTIONS,
  isAuditActionInCategory,
  normalizeAuditEventCategory,
} from "@/lib/auditEvents";
import { isIsoDateTimeString } from "@/lib/auditDisplay";
import type { AuditLogItem, Hotel } from "@/lib/frontend/types";

type AdminAuditClientProps = {
  hotel: Hotel;
  initialLogs: AuditLogItem[];
  actionOptions: string[];
  entityTypeOptions: string[];
  initialFilters: {
    eventCategory: string;
    action: string;
    entityType: string;
    actorUserId: string;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatActor(log: AuditLogItem) {
  if (!log.actor) return "System or deleted user";

  return `${log.actor.firstName} ${log.actor.lastName}`;
}

function formatActorDetail(log: AuditLogItem) {
  if (!log.actor) return log.actorUserId || "-";

  return log.actor.email;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function formatDetailLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";

  if (Array.isArray(value)) {
    if (value.length === 0) return "-";

    return value
      .map((item) => {
        if (isRecord(item)) {
          return Object.entries(item)
            .map(([key, entryValue]) => {
              return `${formatDetailLabel(key)}: ${formatDetailValue(entryValue)}`;
            })
            .join(", ");
        }

        return formatDetailValue(item);
      })
      .join("; ");
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, entryValue]) => {
        return `${formatDetailLabel(key)}: ${formatDetailValue(entryValue)}`;
      })
      .join("; ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string") {
    return isIsoDateTimeString(value) ? formatDate(value) : formatLabel(value);
  }

  return String(value);
}

function getReadableDetails(metadata: unknown) {
  if (!isRecord(metadata)) return [];

  return Object.entries(metadata).map(([key, value]) => ({
    label: formatDetailLabel(key),
    value: formatDetailValue(value),
  }));
}

export function AdminAuditClient({
  hotel,
  initialLogs,
  actionOptions,
  entityTypeOptions,
  initialFilters,
}: AdminAuditClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [eventCategory, setEventCategory] = useState(
    initialFilters.eventCategory,
  );
  const [action, setAction] = useState(initialFilters.action);
  const [entityType, setEntityType] = useState(initialFilters.entityType);
  const [actorUserId, setActorUserId] = useState(initialFilters.actorUserId);
  const [selectedLogId, setSelectedLogId] = useState(initialLogs[0]?.id || "");

  const selectedLog =
    initialLogs.find((log) => log.id === selectedLogId) ||
    initialLogs[0] ||
    null;

  const filteredActionOptions = useMemo(() => {
    const normalizedCategory = normalizeAuditEventCategory(eventCategory);

    if (!normalizedCategory) return actionOptions;

    return actionOptions.filter((item) =>
      isAuditActionInCategory(item, normalizedCategory),
    );
  }, [actionOptions, eventCategory]);

  const actorOptions = useMemo(() => {
    const actors = new Map<string, string>();

    initialLogs.forEach((log) => {
      if (log.actorUserId) {
        actors.set(log.actorUserId, formatActor(log));
      }
    });

    return [...actors.entries()].map(([value, label]) => ({ value, label }));
  }, [initialLogs]);

  function applyFilters() {
    const query = new URLSearchParams(searchParams.toString());

    query.set("hotelId", hotel.id);

    if (eventCategory) {
      query.set("eventCategory", eventCategory);
    } else {
      query.delete("eventCategory");
    }

    if (action) {
      query.set("action", action);
    } else {
      query.delete("action");
    }

    if (entityType) {
      query.set("entityType", entityType);
    } else {
      query.delete("entityType");
    }

    if (actorUserId) {
      query.set("actorUserId", actorUserId);
    } else {
      query.delete("actorUserId");
    }

    router.push(`/admin/audit?${query.toString()}`);
  }

  function clearFilters() {
    setEventCategory("");
    setAction("");
    setEntityType("");
    setActorUserId("");
    router.push(`/admin/audit?hotelId=${hotel.id}`);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Audit
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Review administrative and account security activity for {hotel.name}.
          </p>
        </div>

        <span className="inline-flex rounded-full bg-luxury-gold-soft px-3 py-1 text-xs font-bold text-luxury-navy">
          {initialLogs.length} event{initialLogs.length === 1 ? "" : "s"}
        </span>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-foreground">Filters</h2>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Activity area
              </span>

              <select
                value={eventCategory}
                onChange={(event) => {
                  const nextCategory = event.target.value;

                  setEventCategory(nextCategory);

                  const normalizedCategory =
                    normalizeAuditEventCategory(nextCategory);

                  if (
                    normalizedCategory &&
                    action &&
                    !isAuditActionInCategory(action, normalizedCategory)
                  ) {
                    setAction("");
                  }
                }}
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
              >
                <option value="">All activity</option>
                {AUDIT_EVENT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Action
              </span>

              <select
                value={action}
                onChange={(event) => setAction(event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
              >
                <option value="">All actions</option>
                {filteredActionOptions.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Entity
              </span>

              <select
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
              >
                <option value="">All entities</option>
                {entityTypeOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Actor
              </span>

              <select
                value={actorUserId}
                onChange={(event) => setActorUserId(event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
              >
                <option value="">All actors</option>
                {actorOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <Button
                onClick={applyFilters}
                className="h-11 flex-1 bg-luxury-navy hover:bg-luxury-ink"
              >
                Apply
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={clearFilters}
                className="h-11 flex-1"
              >
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-bold text-foreground">
              Activity history
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest matching audit events.
            </p>
          </CardHeader>

          <CardContent>
            {initialLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No audit events found
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Administrative and account activity will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {initialLogs.map((log) => {
                  const isSelected = log.id === selectedLog?.id;

                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedLogId(log.id)}
                      className={[
                        "w-full rounded-xl border bg-white p-4 text-left transition",
                        isSelected
                          ? "border-luxury-gold bg-luxury-cream ring-4 ring-luxury-gold-soft"
                          : "border-border hover:border-luxury-stone hover:bg-luxury-cream/60",
                      ].join(" ")}
                    >
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-luxury-gold-soft px-3 py-1 text-xs font-bold text-luxury-navy">
                              {formatLabel(log.action)}
                            </span>
                            <Badge>{log.entityType}</Badge>
                          </div>

                          <p className="mt-3 text-sm font-bold text-foreground">
                            {log.summary}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatActor(log)} - {formatActorDetail(log)}
                          </p>
                        </div>

                        <p className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-bold text-foreground">
              Event details
            </h2>
          </CardHeader>

          <CardContent>
            {!selectedLog ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Select an event
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose an audit event to view details.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-luxury-gold-soft px-3 py-1 text-xs font-bold text-luxury-navy">
                      {formatLabel(selectedLog.action)}
                    </span>
                    <Badge>{selectedLog.entityType}</Badge>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-foreground">
                    {selectedLog.summary}
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(selectedLog.createdAt)}
                  </p>
                </div>

                <div className="grid gap-3 rounded-xl bg-surface-muted p-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Actor</p>
                    <p className="mt-1 font-bold text-foreground">
                      {formatActor(selectedLog)}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {formatActorDetail(selectedLog)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Record ID</p>
                    <p className="mt-1 break-all font-bold text-foreground">
                      {selectedLog.entityId || "-"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-foreground">Changes</p>

                  {getReadableDetails(selectedLog.metadata).length > 0 ? (
                    <div className="mt-2 divide-y divide-luxury-stone overflow-hidden rounded-xl border border-luxury-stone bg-white">
                      {getReadableDetails(selectedLog.metadata).map((detail) => (
                        <div
                          key={detail.label}
                          className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[150px_1fr]"
                        >
                          <p className="font-semibold text-slate-500">
                            {detail.label}
                          </p>
                          <p className="break-words font-bold text-luxury-ink">
                            {detail.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
                      No extra details recorded.
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
