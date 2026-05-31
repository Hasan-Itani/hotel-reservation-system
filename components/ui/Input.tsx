import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  const inputId = id || props.name;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">
        {label}
      </span>

      <input
        id={inputId}
        className={[
          "h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm",
          "outline-none transition placeholder:text-muted",
          "focus:border-primary focus:ring-4 focus:ring-primary-soft",
          error ? "border-danger focus:border-danger focus:ring-danger-soft" : "",
          className,
        ].join(" ")}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error && inputId ? `${inputId}-error` : undefined}
        {...props}
      />

      {error ? (
        <span id={inputId ? `${inputId}-error` : undefined} className="mt-2 block text-sm text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}