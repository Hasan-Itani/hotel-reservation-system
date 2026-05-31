"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import type {
    AuthUser,
    GuestProfileUpdateResponse,
} from "@/lib/frontend/types";

type GuestProfileFormProps = {
    user: AuthUser;
};

type ProfileFormState = {
    firstName: string;
    lastName: string;
    phone: string;
};

export function GuestProfileForm({ user }: GuestProfileFormProps) {
    const router = useRouter();

    const [form, setForm] = useState<ProfileFormState>({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || "",
    });

    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    function updateForm<Key extends keyof ProfileFormState>(
        key: Key,
        value: ProfileFormState[Key],
    ) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");
        setSuccessMessage("");

        if (!form.firstName.trim()) {
            setError("First name is required");
            return;
        }

        if (!form.lastName.trim()) {
            setError("Last name is required");
            return;
        }

        setIsSubmitting(true);

        try {
            await clientFetchJson<GuestProfileUpdateResponse>("/api/guest/profile", {
                method: "PUT",
                body: JSON.stringify({
                    firstName: form.firstName,
                    lastName: form.lastName,
                    phone: form.phone,
                }),
            });

            setSuccessMessage("Profile updated");
            router.refresh();
        } catch (caughtError) {
            if (caughtError instanceof FrontendApiError) {
                setError(caughtError.message);
            } else {
                setError("Unable to update profile right now");
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form className="grid gap-4" onSubmit={handleSubmit}>
            {successMessage ? (
                <div className="rounded-xl border border-success-soft bg-success-soft px-4 py-3 text-sm font-medium text-success">
                    {successMessage}
                </div>
            ) : null}

            {error ? (
                <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
                <Input
                    label="First Name"
                    name="firstName"
                    value={form.firstName}
                    onChange={(event) => updateForm("firstName", event.target.value)}
                    required
                />

                <Input
                    label="Last Name"
                    name="lastName"
                    value={form.lastName}
                    onChange={(event) => updateForm("lastName", event.target.value)}
                    required
                />
            </div>

            <Input
                label="Email"
                name="email"
                type="email"
                value={user.email}
                readOnly
                className="bg-surface-muted"
            />

            <p className="-mt-2 text-xs text-muted-foreground">
                Email cannot be changed yet.
            </p>

            <Input
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                placeholder="+961..."
            />

            <Button type="submit" className="h-11" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save profile"}
            </Button>
        </form>
    );
}