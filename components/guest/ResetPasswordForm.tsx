"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import type { ResetPasswordResponse } from "@/lib/frontend/types";
import {
  getUnmetPasswordRequirements,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/passwordPolicy";
import { PasswordPolicyChecklist } from "@/components/guest/PasswordPolicyChecklist";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!token) {
      setError("Password reset link is missing. Request a new reset link.");
      return;
    }

    const unmetRequirement = getUnmetPasswordRequirements(password)[0];

    if (unmetRequirement) {
      setError(`Password requires: ${unmetRequirement.label.toLowerCase()}`);
      return;
    }

    if (password.length > PASSWORD_MAX_LENGTH) {
      setError(`Password must not exceed ${PASSWORD_MAX_LENGTH} characters`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await clientFetchJson<ResetPasswordResponse>(
        "/api/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token,
            password,
          }),
        },
      );

      setMessage(data.message);
      setPassword("");
      setConfirmPassword("");
    } catch (caughtError) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to reset password right now");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-3xl border border-danger-soft bg-danger-soft px-5 py-4 text-sm font-bold text-danger">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-3xl border border-luxury-stone bg-luxury-cream px-5 py-4 text-sm font-bold text-luxury-ink">
          {message}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          New password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          className="h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Confirm new password
        </span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Re-enter your password"
          maxLength={PASSWORD_MAX_LENGTH}
          className="h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft"
        />
      </label>

      <PasswordPolicyChecklist
        password={password}
        confirmPassword={confirmPassword}
      />

      <button
        type="submit"
        disabled={isSubmitting || !token}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink disabled:opacity-60"
      >
        {isSubmitting ? "Updating password..." : "Update password"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Back to{" "}
        <Link
          href="/guest/login"
          className="font-black text-luxury-gold transition hover:text-luxury-ink"
        >
          sign in
        </Link>
      </p>
    </form>
  );
}
