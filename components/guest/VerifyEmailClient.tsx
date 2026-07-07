"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clientFetchJson, FrontendApiError } from "@/lib/frontend/api-client";
import type { VerifyEmailResponse } from "@/lib/frontend/types";

type VerifyEmailClientProps = {
  token: string;
};

export function VerifyEmailClient({ token }: VerifyEmailClientProps) {
  const startedRef = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function verifyEmail() {
      setError("");
      setMessage("");

      if (!token) {
        setError("Email verification link is missing.");
        setIsVerifying(false);
        return;
      }

      try {
        const data = await clientFetchJson<VerifyEmailResponse>(
          "/api/auth/verify-email",
          {
            method: "POST",
            body: JSON.stringify({
              token,
            }),
          },
        );

        setMessage(data.message);
      } catch (caughtError) {
        if (caughtError instanceof FrontendApiError) {
          setError(caughtError.message);
        } else {
          setError("Unable to verify email right now");
        }
      } finally {
        setIsVerifying(false);
      }
    }

    void verifyEmail();
  }, [token]);

  return (
    <div className="grid gap-5">
      {isVerifying ? (
        <div className="rounded-3xl border border-luxury-stone bg-luxury-cream px-5 py-4 text-sm font-bold text-luxury-ink">
          Verifying email...
        </div>
      ) : null}

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

      <Link
        href="/guest/login"
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink"
      >
        Sign in
      </Link>
    </div>
  );
}
