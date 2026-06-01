"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import type { LoginResponse } from "@/lib/frontend/types";

type GuestLoginFormProps = {
  next: string;
};

export function GuestLoginForm({ next }: GuestLoginFormProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    try {
      await clientFetchJson<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      router.replace(next);
      router.refresh();
    } catch (caughtError) {
      if (caughtError instanceof FrontendApiError) {
        setError(caughtError.message);
      } else {
        setError("Unable to login right now");
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

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          className="h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink disabled:opacity-60"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-sm text-slate-600">
        New guest?{" "}
        <Link
          href={`/guest/register?next=${encodeURIComponent(next)}`}
          className="font-black text-luxury-gold transition hover:text-luxury-ink"
        >
          Create account
        </Link>
      </p>
    </form>
  );
}
