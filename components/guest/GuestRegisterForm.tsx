"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-xl border border-danger-soft bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="First Name"
          name="firstName"
          autoComplete="given-name"
          value={form.firstName}
          onChange={(event) => updateForm("firstName", event.target.value)}
          required
        />

        <Input
          label="Last Name"
          name="lastName"
          autoComplete="family-name"
          value={form.lastName}
          onChange={(event) => updateForm("lastName", event.target.value)}
          required
        />
      </div>

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={(event) => updateForm("email", event.target.value)}
        required
      />

      <Input
        label="Phone"
        name="phone"
        autoComplete="tel"
        value={form.phone}
        onChange={(event) => updateForm("phone", event.target.value)}
        placeholder="+961..."
      />

      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={(event) => updateForm("password", event.target.value)}
        placeholder="At least 8 characters"
        required
      />

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/guest/login?next=${encodeURIComponent(next)}`}
          className="font-bold text-primary"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}