import type { DecimalJson } from "@/lib/frontend/types";

export function decimalToNumber(value: DecimalJson | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

export function formatMoney(
  value: DecimalJson | null | undefined,
  currency: string
) {
  const numberValue = decimalToNumber(value);

  if (numberValue === null) {
    return "-";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(numberValue);
}

export function formatNumber(value: DecimalJson | null | undefined) {
  const numberValue = decimalToNumber(value);

  if (numberValue === null) {
    return "-";
  }

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(numberValue);
}