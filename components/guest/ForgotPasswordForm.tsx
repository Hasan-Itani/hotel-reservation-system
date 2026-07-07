"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import type { ForgotPasswordResponse } from "@/lib/frontend/types";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setResetUrl("");
    setIsSubmitting(true);

    try {
      const data = await clientFetchJson<ForgotPasswordResponse>(
        "/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email,
          }),
        },
      );

      setMessage(data.message);
      setResetUrl(data.resetUrl || "");
    } catch (caughtError) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to prepare password reset right now");
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
          <p>{message}</p>

          {resetUrl ? (
            <Link
              href={resetUrl}
              className="mt-3 block break-all text-luxury-gold underline underline-offset-4"
            >
              Open development reset link
            </Link>
          ) : null}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Email
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="guest@example.com"
          className="h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink disabled:opacity-60"
      >
        {isSubmitting ? "Preparing reset..." : "Send reset link"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Remembered your password?{" "}
        <Link
          href="/guest/login"
          className="font-black text-luxury-gold transition hover:text-luxury-ink"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
