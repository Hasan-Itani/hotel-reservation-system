import { Prisma } from "@prisma/client";

export type MoneyInput = Prisma.Decimal | number;

export function decimalToNumber(value: MoneyInput) {
  if (typeof value === "number") {
    return value;
  }

  return value.toNumber();
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeMoney(value: MoneyInput) {
  return roundMoney(decimalToNumber(value));
}

export function addMoney(...values: MoneyInput[]) {
  const total = values.reduce<number>((sum, value) => {
    return sum + decimalToNumber(value);
  }, 0);

  return roundMoney(total);
}

export function subtractMoney(left: MoneyInput, right: MoneyInput) {
  const result = decimalToNumber(left) - decimalToNumber(right);

  return roundMoney(result);
}

export function multiplyMoney(value: MoneyInput, multiplier: number) {
  const result = decimalToNumber(value) * multiplier;

  return roundMoney(result);
}

export function isValidMoneyAmount(value: number) {
  return Number.isFinite(value) && value >= 0;
}