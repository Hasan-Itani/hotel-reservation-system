"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import type {
  AdminHotelInquiryItem,
  AdminHotelInquiryUpdateResponse,
  Hotel,
  HotelInquiryStatus,
  HotelInquiryType,
} from "@/lib/frontend/types";

type AdminInquiriesClientProps = {
  hotel: Hotel;
  initialInquiries: AdminHotelInquiryItem[];
};

const statusOptions: Array<{
  value: HotelInquiryStatus | "ALL";
  label: string;
}> = [
  { value: "ALL", label: "All statuses" },
  { value: "NEW", label: "New" },
  { value: "READ", label: "Read" },
  { value: "REPLIED", label: "Replied" },
  { value: "ARCHIVED", label: "Archived" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStatus(status: HotelInquiryStatus) {
  return status.replaceAll("_", " ");
}

function formatInquiryType(type: HotelInquiryType) {
  return type.replaceAll("_", " ");
}

function getStatusBadgeVariant(
  status: HotelInquiryStatus,
): "success" | "warning" | "danger" | "primary" | "default" {
  if (status === "NEW") return "warning";
  if (status === "READ") return "primary";
  if (status === "REPLIED") return "success";
  if (status === "ARCHIVED") return "default";

  return "default";
}

export function AdminInquiriesClient({
  hotel,
  initialInquiries,
}: AdminInquiriesClientProps) {
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HotelInquiryStatus | "ALL">(
    "ALL",
  );
  const [selectedInquiryId, setSelectedInquiryId] = useState(
    initialInquiries[0]?.id || "",
  );
  const [adminNote, setAdminNote] = useState(
    initialInquiries[0]?.adminNote || "",
  );
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const selectedInquiry =
    inquiries.find((inquiry) => inquiry.id === selectedInquiryId) || null;

  const filteredInquiries = useMemo(() => {
    const value = search.trim().toLowerCase();

    return inquiries.filter((inquiry) => {
      const matchesStatus =
        statusFilter === "ALL" || inquiry.status === statusFilter;

      const matchesSearch =
        !value ||
        inquiry.guestName.toLowerCase().includes(value) ||
        inquiry.guestEmail.toLowerCase().includes(value) ||
        inquiry.subject.toLowerCase().includes(value) ||
        inquiry.message.toLowerCase().includes(value) ||
        inquiry.inquiryType.toLowerCase().includes(value);

      return matchesStatus && matchesSearch;
    });
  }, [inquiries, search, statusFilter]);

  function selectInquiry(inquiry: AdminHotelInquiryItem) {
    setSelectedInquiryId(inquiry.id);
    setAdminNote(inquiry.adminNote || "");
    setError("");
  }

  async function updateInquiry(input: {
    inquiryId: string;
    status?: HotelInquiryStatus;
    adminNote?: string | null;
  }) {
    setError("");
    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/admin/hotels/${hotel.id}/inquiries/${input.inquiryId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: input.status,
            adminNote: input.adminNote,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to update inquiry");
        return;
      }

      const result = data as AdminHotelInquiryUpdateResponse;

      setInquiries((current) =>
        current.map((item) =>
          item.id === result.inquiry.id ? result.inquiry : item,
        ),
      );

      setSelectedInquiryId(result.inquiry.id);
      setAdminNote(result.inquiry.adminNote || "");
    } catch {
      setError("Unable to update inquiry");
    } finally {
      setIsUpdating(false);
    }
  }

  function updateSelectedStatus(status: HotelInquiryStatus) {
    if (!selectedInquiry) return;

    updateInquiry({
      inquiryId: selectedInquiry.id,
      status,
      adminNote,
    });
  }

  function saveAdminNote() {
    if (!selectedInquiry) return;

    updateInquiry({
      inquiryId: selectedInquiry.id,
      adminNote,
    });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Inquiries
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            View public contact messages submitted for {hotel.name}.
          </p>
        </div>

        <Badge variant="primary">
          {inquiries.length} message{inquiries.length === 1 ? "" : "s"}
        </Badge>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-base font-bold text-foreground">Filters</h2>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-[1fr_240px]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Search
              </span>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, subject, message, or type"
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                Status
              </span>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as HotelInquiryStatus | "ALL",
                  )
                }
                className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
              >
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-bold text-foreground">
              Message list
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {filteredInquiries.length} result
              {filteredInquiries.length === 1 ? "" : "s"} found.
            </p>
          </CardHeader>

          <CardContent className="min-w-0">
            {filteredInquiries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No inquiries found
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Public contact messages will appear here after guests submit
                  the hotel contact form.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInquiries.map((inquiry) => {
                  const isSelected = inquiry.id === selectedInquiryId;

                  return (
                    <button
                      key={inquiry.id}
                      type="button"
                      onClick={() => selectInquiry(inquiry)}
                      className={[
                        "w-full rounded-xl border bg-white p-4 text-left transition",
                        isSelected
                          ? "border-primary ring-4 ring-primary-soft"
                          : "border-border hover:border-primary-soft hover:bg-surface-muted",
                      ].join(" ")}
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={getStatusBadgeVariant(inquiry.status)}
                            >
                              {formatStatus(inquiry.status)}
                            </Badge>

                            <Badge>{formatInquiryType(inquiry.inquiryType)}</Badge>
                          </div>

                          <p className="mt-3 truncate text-base font-bold text-foreground">
                            {inquiry.subject}
                          </p>

                          <p className="mt-1 text-sm text-muted-foreground">
                            {inquiry.guestName} · {inquiry.guestEmail}
                          </p>
                        </div>

                        <p className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(inquiry.createdAt)}
                        </p>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {inquiry.message}
                      </p>
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
              Message details
            </h2>
          </CardHeader>

          <CardContent>
            {!selectedInquiry ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Select a message
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose an inquiry to view the full content.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {error ? (
                  <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                    {error}
                  </div>
                ) : null}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={getStatusBadgeVariant(selectedInquiry.status)}
                    >
                      {formatStatus(selectedInquiry.status)}
                    </Badge>

                    <Badge>
                      {formatInquiryType(selectedInquiry.inquiryType)}
                    </Badge>
                  </div>

                  <h3 className="mt-3 text-xl font-bold text-foreground">
                    {selectedInquiry.subject}
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Received {formatDate(selectedInquiry.createdAt)}
                  </p>
                </div>

                <div className="grid gap-3 rounded-xl bg-surface-muted p-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Guest</p>
                    <p className="mt-1 font-bold text-foreground">
                      {selectedInquiry.guestName}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="mt-1 break-all font-bold text-foreground">
                      {selectedInquiry.guestEmail}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="mt-1 break-all font-bold text-foreground">
                      {selectedInquiry.guestPhone || "-"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-foreground">Message</p>
                  <div className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-white p-4 text-sm leading-7 text-muted-foreground">
                    {selectedInquiry.message}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-foreground">
                    Admin note
                  </span>

                  <textarea
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                    rows={5}
                    placeholder="Internal note for this inquiry..."
                    className="w-full rounded-xl border border-border bg-white px-3 py-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft"
                  />
                </label>

                <div className="grid gap-2">
                  <Button
                    onClick={saveAdminNote}
                    disabled={isUpdating}
                    className="w-full"
                  >
                    Save note
                  </Button>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="secondary"
                      onClick={() => updateSelectedStatus("READ")}
                      disabled={isUpdating}
                    >
                      Mark read
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => updateSelectedStatus("REPLIED")}
                      disabled={isUpdating}
                    >
                      Mark replied
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => updateSelectedStatus("NEW")}
                      disabled={isUpdating}
                    >
                      Mark new
                    </Button>

                    <Button
                      variant="danger"
                      onClick={() => updateSelectedStatus("ARCHIVED")}
                      disabled={isUpdating}
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}