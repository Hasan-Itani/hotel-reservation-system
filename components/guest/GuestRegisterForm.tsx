"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import type { GuestRegisterResponse } from "@/lib/frontend/types";
import {
  getUnmetPasswordRequirements,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/passwordPolicy";
import { PasswordPolicyChecklist } from "@/components/guest/PasswordPolicyChecklist";

type RegisterFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

const defaultForm: RegisterFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

type GuestRegisterFormProps = {
  next: string;
};

export function GuestRegisterForm({ next }: GuestRegisterFormProps) {
  const [form, setForm] = useState<RegisterFormState>(defaultForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setMessage("");

    const unmetRequirement = getUnmetPasswordRequirements(form.password)[0];

    if (unmetRequirement) {
      setError(`Password requires: ${unmetRequirement.label.toLowerCase()}`);
      return;
    }

    if (form.password.length > PASSWORD_MAX_LENGTH) {
      setError(`Password must not exceed ${PASSWORD_MAX_LENGTH} characters`);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await clientFetchJson<GuestRegisterResponse>("/api/guest/register", {
        method: "POST",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          password: form.password,
        }),
      });

      setMessage(data.message);
      setForm(defaultForm);
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

      {message ? (
        <div className="rounded-3xl border border-luxury-stone bg-luxury-cream px-5 py-4 text-sm font-bold text-luxury-ink">
          <p>{message}</p>
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
          placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          required
          className={inputClassName}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Confirm password
        </span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(event) =>
            updateForm("confirmPassword", event.target.value)
          }
          placeholder="Re-enter your password"
          maxLength={PASSWORD_MAX_LENGTH}
          required
          className={inputClassName}
        />
      </label>

      <PasswordPolicyChecklist
        password={form.password}
        confirmPassword={form.confirmPassword}
      />

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
