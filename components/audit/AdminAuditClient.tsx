"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type { AuditLogItem, Hotel } from "@/lib/frontend/types";

type AdminAuditClientProps = {
  hotel: Hotel;
  initialLogs: AuditLogItem[];
  actionOptions: string[];
  entityTypeOptions: string[];
  initialFilters: {
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
  return value.replaceAll("_", " ");
}

function formatActor(log: AuditLogItem) {
  if (!log.actor) return "System or deleted user";

  return `${log.actor.firstName} ${log.actor.lastName}`;
}

function formatActorDetail(log: AuditLogItem) {
  if (!log.actor) return log.actorUserId || "-";

  return log.actor.email;
}

function stringifyMetadata(metadata: unknown) {
  if (!metadata) return "";

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
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
  const [action, setAction] = useState(initialFilters.action);
  const [entityType, setEntityType] = useState(initialFilters.entityType);
  const [actorUserId, setActorUserId] = useState(initialFilters.actorUserId);
  const [selectedLogId, setSelectedLogId] = useState(initialLogs[0]?.id || "");

  const selectedLog =
    initialLogs.find((log) => log.id === selectedLogId) || null;

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
            Review admin activity history for {hotel.name}.
          </p>
        </div>

        <Badge variant="primary">
          {initialLogs.length} event{initialLogs.length === 1 ? "" : "s"}
        </Badge>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-foreground">Filters</h2>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 lg:grid-cols-4">
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
                {actionOptions.map((item) => (
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
              <Button onClick={applyFilters} className="h-11 flex-1">
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
                  Admin actions will appear here after staff changes records.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {initialLogs.map((log) => {
                  const isSelected = log.id === selectedLogId;

                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelectedLogId(log.id)}
                      className={[
                        "w-full rounded-xl border bg-white p-4 text-left transition",
                        isSelected
                          ? "border-primary ring-4 ring-primary-soft"
                          : "border-border hover:border-primary-soft hover:bg-surface-muted",
                      ].join(" ")}
                    >
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="primary">
                              {formatLabel(log.action)}
                            </Badge>
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
                    <Badge variant="primary">
                      {formatLabel(selectedLog.action)}
                    </Badge>
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
                    <p className="text-xs text-muted-foreground">Entity ID</p>
                    <p className="mt-1 break-all font-bold text-foreground">
                      {selectedLog.entityId || "-"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-foreground">
                    Metadata
                  </p>

                  {stringifyMetadata(selectedLog.metadata) ? (
                    <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-border bg-slate-950 p-4 text-xs leading-6 text-white">
                      {stringifyMetadata(selectedLog.metadata)}
                    </pre>
                  ) : (
                    <div className="mt-2 rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-muted-foreground">
                      No metadata recorded.
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
