"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import { isSuperAdmin } from "@/lib/frontend/permissions";
import type {
    AuthUser,
    DeleteStaffResponse,
    Hotel,
    HotelStaffRoleName,
    StaffMember,
    StaffMemberResponse,
} from "@/lib/frontend/types";

type StaffClientProps = {
    hotel: Hotel;
    currentUser: AuthUser;
    initialStaff: StaffMember[];
};

type StaffFormState = {
    staffId?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    roleName: HotelStaffRoleName;
};

const roleOptions: HotelStaffRoleName[] = [
    "HOTEL_ADMIN",
    "MANAGER",
    "RECEPTIONIST",
];

const emptyForm: StaffFormState = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    roleName: "RECEPTIONIST",
};

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    }).format(new Date(value));
}

function roleBadgeVariant(
    role: string
): "primary" | "success" | "warning" | "default" {
    if (role === "HOTEL_ADMIN") return "primary";
    if (role === "MANAGER") return "success";
    if (role === "RECEPTIONIST") return "warning";
    return "default";
}

function statusBadgeVariant(
    status: string
): "success" | "warning" | "danger" | "default" {
    if (status === "ACTIVE") return "success";
    if (status === "INACTIVE") return "warning";
    if (status === "SUSPENDED") return "danger";
    return "default";
}

export function StaffClient({
    hotel,
    currentUser,
    initialStaff,
}: StaffClientProps) {
    const router = useRouter();
    const formRef = useRef<HTMLDivElement | null>(null);

    const [staff, setStaff] = useState(initialStaff);
    const [form, setForm] = useState<StaffFormState>(emptyForm);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [removingId, setRemovingId] = useState("");
    const [pendingRemoveStaff, setPendingRemoveStaff] =
        useState<StaffMember | null>(null);

    const isEditing = !!form.staffId;
    const currentUserIsSuperAdmin = isSuperAdmin(currentUser);

    const sortedStaff = useMemo(() => {
        return [...staff].sort((a, b) => {
            const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
            const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();

            return nameA.localeCompare(nameB);
        });
    }, [staff]);

    function scrollToForm() {
        window.setTimeout(() => {
            formRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 0);
    }

    function openCreateForm() {
        setError("");
        setForm(emptyForm);
        setIsFormOpen(true);
        scrollToForm();
    }

    function openEditForm(staffMember: StaffMember) {
        const currentRole =
            roleOptions.find((roleName) =>
                staffMember.roles.some((role) => role.name === roleName)
            ) || "RECEPTIONIST";

        setError("");
        setForm({
            staffId: staffMember.id,
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            password: "",
            roleName: currentRole,
        });
        setIsFormOpen(true);
        scrollToForm();
    }

    function closeForm() {
        setError("");
        setForm(emptyForm);
        setIsFormOpen(false);
    }



    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");

        if (!isEditing) {
            if (!form.firstName.trim()) {
                setError("First name is required");
                return;
            }

            if (!form.lastName.trim()) {
                setError("Last name is required");
                return;
            }

            if (!form.email.trim()) {
                setError("Email is required");
                return;
            }

            if (form.password.length < 8) {
                setError("Password must be at least 8 characters");
                return;
            }
        }

        if (!form.roleName) {
            setError("Select a role");
            return;
        }

        setIsSubmitting(true);

        try {
            if (isEditing && form.staffId) {
                const data = await clientFetchJson<StaffMemberResponse>(
                    `/api/admin/hotels/${hotel.id}/staff/${form.staffId}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            roleNames: [form.roleName],
                        }),
                    }
                );

                setStaff((current) =>
                    current.map((item) => (item.id === data.staff.id ? data.staff : item))
                );
            } else {
                const data = await clientFetchJson<StaffMemberResponse>(
                    `/api/admin/hotels/${hotel.id}/staff`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            firstName: form.firstName.trim(),
                            lastName: form.lastName.trim(),
                            email: form.email.trim(),
                            phone: form.phone.trim() || undefined,
                            password: form.password,
                            roleNames: [form.roleName],
                        }),
                    }
                );

                setStaff((current) => [...current, data.staff]);
            }

            closeForm();
            router.refresh();
        } catch (caughtError: unknown) {
            if (caughtError instanceof FrontendApiError) {
                setError(caughtError.message);
            } else {
                setError("Unable to save staff member");
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    async function removeStaffMember(staffMember: StaffMember) {
        setRemovingId(staffMember.id);
        setError("");

        try {
            await clientFetchJson<DeleteStaffResponse>(
                `/api/admin/hotels/${hotel.id}/staff/${staffMember.id}`,
                {
                    method: "DELETE",
                }
            );

            setStaff((current) => current.filter((item) => item.id !== staffMember.id));
            setPendingRemoveStaff(null);
            router.refresh();
        } catch (caughtError: unknown) {
            if (caughtError instanceof FrontendApiError) {
                setError(caughtError.message);
            } else {
                setError("Unable to remove staff member");
            }
        } finally {
            setRemovingId("");
        }
    }

    return (
        <div className="space-y-6">
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Staff
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage hotel staff role assignments for {hotel.name}.
                    </p>
                </div>

                <Button onClick={openCreateForm}>Assign Staff</Button>
            </section>

            {error ? (
                <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                    {error}
                </div>
            ) : null}

            {pendingRemoveStaff ? (
                <Card className="border-danger-soft bg-danger-soft/50">
                    <CardContent>
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <p className="text-sm font-bold text-foreground">
                                    Remove {pendingRemoveStaff.firstName}{" "}
                                    {pendingRemoveStaff.lastName} from {hotel.name}?
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    This removes the hotel staff assignment. It does not
                                    delete the user account.
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={() => setPendingRemoveStaff(null)}
                                >
                                    Keep staff
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => removeStaffMember(pendingRemoveStaff)}
                                    disabled={removingId === pendingRemoveStaff.id}
                                >
                                    {removingId === pendingRemoveStaff.id
                                        ? "Removing..."
                                        : "Remove staff"}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            {isFormOpen ? (
                <div ref={formRef}>
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                <div>
                                    <h2 className="text-base font-bold text-foreground">
                                        {isEditing ? "Edit Staff Role" : "Create Staff User"}
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Allowed roles: HOTEL_ADMIN, MANAGER, RECEPTIONIST.
                                    </p>
                                </div>

                                <Button variant="ghost" onClick={closeForm}>
                                    Cancel
                                </Button>
                            </div>
                        </CardHeader>

                        <CardContent>
                            <form className="space-y-5" onSubmit={handleSubmit}>
                                {!isEditing ? (
                                    <div className="grid gap-5 lg:grid-cols-2">
                                        <Input
                                            label="First Name"
                                            name="firstName"
                                            required
                                            value={form.firstName}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    firstName: event.target.value,
                                                }))
                                            }
                                            placeholder="Sarah"
                                        />

                                        <Input
                                            label="Last Name"
                                            name="lastName"
                                            required
                                            value={form.lastName}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    lastName: event.target.value,
                                                }))
                                            }
                                            placeholder="Mansour"
                                        />

                                        <Input
                                            label="Email"
                                            name="email"
                                            type="email"
                                            required
                                            value={form.email}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    email: event.target.value,
                                                }))
                                            }
                                            placeholder="staff@example.com"
                                        />

                                        <Input
                                            label="Phone"
                                            name="phone"
                                            value={form.phone}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    phone: event.target.value,
                                                }))
                                            }
                                            placeholder="+96170000000"
                                        />

                                        <Input
                                            label="Temporary Password"
                                            name="password"
                                            type="password"
                                            required
                                            minLength={8}
                                            value={form.password}
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    password: event.target.value,
                                                }))
                                            }
                                            placeholder="At least 8 characters"
                                        />
                                    </div>
                                ) : null}

                                <div>
                                    <p className="mb-3 text-sm font-medium text-foreground">
                                        Hotel Roles
                                    </p>

                                    <div className="grid gap-3 sm:grid-cols-3">
                                        {roleOptions.map((roleName) => (
                                            <label
                                                key={roleName}
                                                className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm font-medium text-foreground shadow-sm"
                                            >
                                                <input
                                                    type="radio"
                                                    name="hotelRole"
                                                    checked={form.roleName === roleName}
                                                    onChange={() =>
                                                        setForm((current) => ({
                                                            ...current,
                                                            roleName,
                                                        }))
                                                    }
                                                    className="h-4 w-4"
                                                />
                                                {roleName}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting
                                            ? "Saving..."
                                            : isEditing
                                                ? "Save Roles"
                                                : "Assign Staff"}
                                    </Button>

                                    <Button variant="secondary" onClick={closeForm}>
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            ) : null}

            <Card>
                <CardHeader>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-base font-bold text-foreground">
                                {hotel.name}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {sortedStaff.length} staff member
                                {sortedStaff.length === 1 ? "" : "s"} assigned.
                            </p>
                        </div>

                        <Badge variant="primary">HOTEL_ADMIN only</Badge>
                    </div>
                </CardHeader>

                <CardContent>
                    {sortedStaff.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-surface-muted px-4 py-10 text-center">
                            <p className="text-sm font-semibold text-foreground">
                                No staff assigned
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Assign an existing active user to this hotel.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[950px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                                        <th className="py-3 pr-4 font-semibold">Staff Member</th>
                                        <th className="py-3 pr-4 font-semibold">Contact</th>
                                        <th className="py-3 pr-4 font-semibold">Status</th>
                                        <th className="py-3 pr-4 font-semibold">Roles</th>
                                        <th className="py-3 pr-4 font-semibold">Assigned</th>
                                        <th className="py-3 text-right font-semibold">Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {sortedStaff.map((staffMember) => {
                                        const isSelf = staffMember.id === currentUser.id;
                                        const cannotModifySelf = isSelf && !currentUserIsSuperAdmin;

                                        return (
                                            <tr key={staffMember.id} className="border-b border-border">
                                                <td className="py-4 pr-4 align-top">
                                                    <p className="font-semibold text-foreground">
                                                        {staffMember.firstName} {staffMember.lastName}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        ID: {staffMember.id}
                                                    </p>
                                                </td>

                                                <td className="py-4 pr-4 align-top text-sm text-muted-foreground">
                                                    <p>{staffMember.email}</p>
                                                    <p>{staffMember.phone || "-"}</p>
                                                </td>

                                                <td className="py-4 pr-4 align-top">
                                                    <Badge variant={statusBadgeVariant(staffMember.status)}>
                                                        {staffMember.status}
                                                    </Badge>
                                                </td>

                                                <td className="py-4 pr-4 align-top">
                                                    <div className="flex flex-wrap gap-2">
                                                        {staffMember.roles.map((role) => (
                                                            <Badge
                                                                key={role.id}
                                                                variant={roleBadgeVariant(role.name)}
                                                            >
                                                                {role.name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </td>

                                                <td className="py-4 pr-4 align-top text-sm text-muted-foreground">
                                                    {formatDate(staffMember.assignedAt)}
                                                </td>

                                                <td className="py-4 align-top">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="secondary"
                                                            onClick={() => openEditForm(staffMember)}
                                                            disabled={cannotModifySelf}
                                                            title={
                                                                cannotModifySelf
                                                                    ? "Another HOTEL_ADMIN or SUPER_ADMIN must update your roles"
                                                                    : "Edit staff roles"
                                                            }
                                                        >
                                                            Edit
                                                        </Button>

                                                        <Button
                                                            variant="danger"
                                                            onClick={() =>
                                                                setPendingRemoveStaff(staffMember)
                                                            }
                                                            disabled={
                                                                removingId === staffMember.id || cannotModifySelf
                                                            }
                                                            title={
                                                                cannotModifySelf
                                                                    ? "You cannot remove yourself from staff"
                                                                    : "Remove staff member"
                                                            }
                                                        >
                                                            {removingId === staffMember.id
                                                                ? "Removing..."
                                                                : "Remove"}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
