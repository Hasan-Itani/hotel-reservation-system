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
      href: "/admin/inquiries",
      label: "Inquiries",
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
            "block rounded-2xl px-4 py-3 text-sm font-bold transition",
            isActive
              ? "bg-luxury-gold text-luxury-navy shadow-sm shadow-black/10"
              : "text-white/65 hover:bg-white/10 hover:text-white",
          ].join(" ")}
        >
          {item.label}
        </Link>
      );
    });
  }

  return (
    <div className="min-h-screen bg-luxury-cream text-luxury-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/10 bg-luxury-navy text-white shadow-2xl shadow-slate-950/20 lg:block">
        <div className="flex h-20 items-center border-b border-white/10 px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-base font-bold text-luxury-navy shadow-sm">
            H
          </div>

          <div className="ml-3">
            <p className="text-sm font-bold tracking-wide text-white">
              Hotel System
            </p>
            <p className="text-xs text-white/55">Admin Panel</p>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-luxury-gold-soft">
              Active hotel
            </p>
            <p className="mt-2 line-clamp-2 text-sm font-bold text-white">
              {hotels.find((hotel) => hotel.id === selectedHotelId)?.name ||
                "No hotel selected"}
            </p>
          </div>
        </div>

        <nav className="space-y-1 px-4 pb-5">{renderNavLinks()}</nav>
      </aside>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setIsMobileNavOpen(false)}
          />

          <aside className="relative h-full w-80 max-w-[86vw] border-r border-white/10 bg-luxury-navy text-white shadow-xl">
            <div className="flex h-20 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-base font-bold text-luxury-navy">
                  H
                </div>

                <div className="ml-3">
                  <p className="text-sm font-bold text-white">
                    Hotel System
                  </p>
                  <p className="text-xs text-white/55">Admin Panel</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-white"
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

      <div className="min-w-0 lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-luxury-stone bg-white/90 shadow-sm shadow-slate-900/5 backdrop-blur-xl">
          <div className="flex min-h-20 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-luxury-stone bg-white text-luxury-ink shadow-sm lg:hidden"
                aria-label="Open navigation"
                aria-expanded={isMobileNavOpen}
              >
                <span className="space-y-1">
                  <span className="block h-0.5 w-5 bg-luxury-ink" />
                  <span className="block h-0.5 w-5 bg-luxury-ink" />
                  <span className="block h-0.5 w-5 bg-luxury-ink" />
                </span>
              </button>

              <div>
                <p className="text-sm font-black text-luxury-ink">
                  {fullName}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Staff workspace
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

        <main className="min-w-0 overflow-x-hidden px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
