import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-sm hover:bg-primary-hover focus-visible:outline-primary",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-muted focus-visible:outline-primary",
  danger:
    "bg-danger text-white shadow-sm hover:brightness-95 focus-visible:outline-danger",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-primary",
};

export function Button({
  type = "button",
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:opacity-60",
        variants[variant],
        className,
      ].join(" ")}
      {...props}
    />
  );
}