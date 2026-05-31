"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { AuthUser, Hotel } from "@/lib/frontend/types";
import {
  canManageHotelSetup,
  canManagePayments,
  canManageReservations,
  canManageStaff,
  canViewGuests,
  isSuperAdmin,
} from "@/lib/frontend/permissions";
import { Badge } from "@/components/ui/Badge";
import { HotelSelector } from "@/components/layout/HotelSelector";
import { LogoutButton } from "@/components/layout/LogoutButton";

type AdminShellProps = {
  user: AuthUser;
  hotels: Hotel[];
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  allowed: boolean;
};

export function AdminShell({ user, hotels, children }: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const selectedHotelId = searchParams.get("hotelId") || hotels[0]?.id || "";
  const fullName = `${user.firstName} ${user.lastName}`;

  const navItems: NavItem[] = [
    {
      href: "/admin",
      label: "Dashboard",
      allowed: true,
    },
    {
      href: "/admin/room-types",
      label: "Room Types",
      allowed:
        selectedHotelId.length > 0 &&
        canManageHotelSetup(user, selectedHotelId),
    },
    {
      href: "/admin/rooms",
      label: "Rooms",
      allowed:
        selectedHotelId.length > 0 &&
        canManageHotelSetup(user, selectedHotelId),
    },
    {
      href: "/admin/staff",
      label: "Staff",
      allowed:
        selectedHotelId.length > 0 && canManageStaff(user, selectedHotelId),
    },
    {
      href: "/admin/reservations",
      label: "Reservations",
      allowed:
        selectedHotelId.length > 0 &&
        canManageReservations(user, selectedHotelId),
    },
    {
      href: "/admin/guests",
      label: "Guests",
      allowed:
        selectedHotelId.length > 0 && canViewGuests(user, selectedHotelId),
    },
    {
      href: "/admin/payments",
      label: "Payments",
      allowed:
        selectedHotelId.length > 0 && canManagePayments(user, selectedHotelId),
    },
  ];

  const visibleNavItems = navItems.filter((item) => item.allowed);

  function withHotelId(href: string) {
    if (!selectedHotelId) {
      return href;
    }

    return `${href}?hotelId=${selectedHotelId}`;
  }

  function isActiveNavItem(href: string) {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function renderNavLinks(onNavigate?: () => void) {
    return visibleNavItems.map((item) => {
      const isActive = isActiveNavItem(item.href);

      return (
        <Link
          key={item.href}
          href={withHotelId(item.href)}
          onClick={onNavigate}
          className={[
            "block rounded-xl px-3 py-2 text-sm font-medium transition",
            isActive
              ? "bg-primary text-white shadow-sm"
              : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
          ].join(" ")}
        >
          {item.label}
        </Link>
      );
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">
        <div className="flex h-16 items-center border-b border-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-base font-bold text-white">
            H
          </div>

          <div className="ml-3">
            <p className="text-sm font-bold text-foreground">Hotel System</p>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-5">{renderNavLinks()}</nav>
      </aside>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setIsMobileNavOpen(false)}
          />

          <aside className="relative h-full w-72 max-w-[85vw] border-r border-border bg-surface shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <div className="flex items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-base font-bold text-white">
                  H
                </div>

                <div className="ml-3">
                  <p className="text-sm font-bold text-foreground">
                    Hotel System
                  </p>
                  <p className="text-xs text-muted-foreground">Admin Panel</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground"
              >
                Close
              </button>
            </div>

            <nav className="space-y-1 px-3 py-5">
              {renderNavLinks(() => setIsMobileNavOpen(false))}
            </nav>
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
          <div className="flex min-h-16 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-foreground shadow-sm lg:hidden"
                aria-label="Open navigation"
                aria-expanded={isMobileNavOpen}
              >
                <span className="space-y-1">
                  <span className="block h-0.5 w-5 bg-foreground" />
                  <span className="block h-0.5 w-5 bg-foreground" />
                  <span className="block h-0.5 w-5 bg-foreground" />
                </span>
              </button>

              <div>
                <p className="text-sm font-semibold text-foreground">
                  {fullName}
                </p>

                <div className="mt-1 flex flex-wrap gap-2">
                  {isSuperAdmin(user) ? (
                    <Badge variant="primary">SUPER ADMIN</Badge>
                  ) : null}

                  {user.hotelRoles.slice(0, 2).map((item) => (
                    <Badge
                      key={`${item.hotelId}-${item.role}`}
                      variant="default"
                    >
                      {item.role}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <HotelSelector hotels={hotels} />
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="min-w-0 overflow-x-hidden px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}