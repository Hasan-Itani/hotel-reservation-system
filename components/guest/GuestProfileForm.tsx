"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
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

  const inputClassName =
    "h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      {successMessage ? (
        <div className="rounded-3xl border border-success-soft bg-success-soft px-5 py-4 text-sm font-bold text-success">
          {successMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-danger-soft bg-danger-soft px-5 py-4 text-sm font-bold text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-luxury-ink">
            First name
          </span>
          <input
            name="firstName"
            value={form.firstName}
            onChange={(event) => updateForm("firstName", event.target.value)}
            required
            className={inputClassName}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-luxury-ink">
            Last name
          </span>
          <input
            name="lastName"
            value={form.lastName}
            onChange={(event) => updateForm("lastName", event.target.value)}
            required
            className={inputClassName}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Email
        </span>
        <input
          name="email"
          type="email"
          value={user.email}
          readOnly
          className={inputClassName}
        />
        <span className="mt-2 block text-xs text-slate-500">
          Email cannot be changed yet.
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Phone
        </span>
        <input
          name="phone"
          value={form.phone}
          onChange={(event) => updateForm("phone", event.target.value)}
          placeholder="+961..."
          className={inputClassName}
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink disabled:opacity-60"
      >
        {isSubmitting ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}