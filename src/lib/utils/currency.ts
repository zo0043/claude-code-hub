import Decimal from "decimal.js-light";
import { logger } from '@/lib/logger';
import type { Numeric } from "decimal.js-light";

Decimal.set({
  precision: 30,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30,
});

export const COST_SCALE = 15;

export type DecimalInput = Numeric | null | undefined;

export function toDecimal(value: DecimalInput): Decimal | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Decimal) {
    return value;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  try {
    return new Decimal(value);
  } catch (error) {
    logger.error('Failed to create Decimal from value', { context: value, error });
    return null;
  }
}

export function toCostDecimal(value: DecimalInput): Decimal | null {
  const decimal = toDecimal(value);
  return decimal ? decimal.toDecimalPlaces(COST_SCALE) : null;
}

export function formatCostForStorage(value: DecimalInput): string | null {
  const decimal = toCostDecimal(value);
  return decimal ? decimal.toFixed(COST_SCALE) : null;
}

export function costToNumber(value: DecimalInput, fractionDigits = 6): number {
  const decimal = toDecimal(value) ?? new Decimal(0);
  return Number(decimal.toDecimalPlaces(fractionDigits).toString());
}

export function sumCosts(values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((acc, current) => {
    const decimal = toDecimal(current);
    return decimal ? acc.plus(decimal) : acc;
  }, new Decimal(0));
}

export function formatCurrency(value: DecimalInput, fractionDigits = 2): string {
  const decimal = toDecimal(value) ?? new Decimal(0);
  const formatted = decimal.toDecimalPlaces(fractionDigits).toNumber().toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `$${formatted}`;
}

export { Decimal };
