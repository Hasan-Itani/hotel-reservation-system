"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import type { GuestRegisterResponse } from "@/lib/frontend/types";
import { getSafeRedirectPath } from "@/lib/frontend/safe-redirect";

type RegisterFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

const defaultForm: RegisterFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
};

export function GuestRegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState<RegisterFormState>(defaultForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const next = getSafeRedirectPath(searchParams.get("next"));

  function updateForm<Key extends keyof RegisterFormState>(
    key: Key,
    value: RegisterFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      await clientFetchJson<GuestRegisterResponse>("/api/guest/register", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          password: form.password,
        }),
      });

      router.replace(next);
      router.refresh();
    } catch (caughtError) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to create account right now");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    "h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft";

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
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
            autoComplete="given-name"
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
            autoComplete="family-name"
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
          autoComplete="email"
          value={form.email}
          onChange={(event) => updateForm("email", event.target.value)}
          required
          className={inputClassName}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Phone
        </span>
        <input
          name="phone"
          autoComplete="tel"
          value={form.phone}
          onChange={(event) => updateForm("phone", event.target.value)}
          placeholder="+961..."
          className={inputClassName}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => updateForm("password", event.target.value)}
          placeholder="At least 8 characters"
          required
          className={inputClassName}
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink disabled:opacity-60"
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link
          href={`/guest/login?next=${encodeURIComponent(next)}`}
          className="font-black text-luxury-gold transition hover:text-luxury-ink"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}