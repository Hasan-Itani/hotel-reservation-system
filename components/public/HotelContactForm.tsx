"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type {
  HotelInquiryType,
  PublicHotelInquiryCreateResponse,
} from "@/lib/frontend/types";

type HotelContactFormProps = {
  hotelSlug: string;
};

type ContactFormState = {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  inquiryType: HotelInquiryType;
  subject: string;
  message: string;
};

const defaultForm: ContactFormState = {
  guestName: "",
  guestEmail: "",
  guestPhone: "",
  inquiryType: "GENERAL",
  subject: "",
  message: "",
};

const inquiryTypes: Array<{
  value: HotelInquiryType;
  label: string;
}> = [
  { value: "GENERAL", label: "General inquiry" },
  { value: "RESERVATION", label: "Reservation question" },
  { value: "PAYMENT", label: "Payment support" },
  { value: "DINING", label: "Dining inquiry" },
  { value: "EVENT", label: "Event inquiry" },
  { value: "OTHER", label: "Other" },
];

export function HotelContactForm({ hotelSlug }: HotelContactFormProps) {
  const [form, setForm] = useState<ContactFormState>(defaultForm);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateForm<Key extends keyof ContactFormState>(
    key: Key,
    value: ContactFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitContactForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccessMessage("");

    if (!form.guestName.trim()) {
      setError("Name is required");
      return;
    }

    if (!form.guestEmail.trim()) {
      setError("Email is required");
      return;
    }

    if (!form.subject.trim()) {
      setError("Subject is required");
      return;
    }

    if (form.message.trim().length < 10) {
      setError("Message must be at least 10 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/public/hotels/${hotelSlug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guestName: form.guestName,
          guestEmail: form.guestEmail,
          guestPhone: form.guestPhone,
          inquiryType: form.inquiryType,
          subject: form.subject,
          message: form.message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to send contact message");
        return;
      }

      const result = data as PublicHotelInquiryCreateResponse;

      setSuccessMessage(
        `Message sent. Reference ID: ${result.inquiry.id.slice(0, 8).toUpperCase()}`,
      );
      setForm(defaultForm);
    } catch {
      setError("Unable to send contact message");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    "h-12 w-full rounded-2xl border border-luxury-stone bg-white px-4 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft";

  return (
    <form className="grid gap-5" onSubmit={submitContactForm}>
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
            Name
          </span>
          <input
            name="guestName"
            value={form.guestName}
            onChange={(event) => updateForm("guestName", event.target.value)}
            placeholder="Your name"
            required
            className={inputClassName}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-luxury-ink">
            Email
          </span>
          <input
            name="guestEmail"
            type="email"
            value={form.guestEmail}
            onChange={(event) => updateForm("guestEmail", event.target.value)}
            placeholder="guest@example.com"
            required
            className={inputClassName}
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-luxury-ink">
            Phone
          </span>
          <input
            name="guestPhone"
            value={form.guestPhone}
            onChange={(event) => updateForm("guestPhone", event.target.value)}
            placeholder="+961..."
            className={inputClassName}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-luxury-ink">
            Inquiry type
          </span>
          <select
            name="inquiryType"
            value={form.inquiryType}
            onChange={(event) =>
              updateForm("inquiryType", event.target.value as HotelInquiryType)
            }
            className={inputClassName}
          >
            {inquiryTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Subject
        </span>
        <input
          name="subject"
          value={form.subject}
          onChange={(event) => updateForm("subject", event.target.value)}
          placeholder="How can we help?"
          required
          className={inputClassName}
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-luxury-ink">
          Message
        </span>
        <textarea
          name="message"
          value={form.message}
          onChange={(event) => updateForm("message", event.target.value)}
          placeholder="Write your message..."
          rows={6}
          required
          className="w-full rounded-2xl border border-luxury-stone bg-white px-4 py-3 text-sm text-luxury-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-luxury-gold focus:ring-4 focus:ring-luxury-gold-soft"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-12 items-center justify-center rounded-full bg-luxury-navy px-6 text-sm font-bold text-white shadow-sm transition hover:bg-luxury-ink disabled:opacity-60"
      >
        {isSubmitting ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}