import { Prisma } from '../generated/prisma/client.js';

export type Decimal = Prisma.Decimal;

/** String from the API → exact decimal (never parseFloat). */
export function toDecimal(value: string): Decimal {
  return new Prisma.Decimal(value);
}

/**
 * Decimal (or the numeric value that `$queryRaw` returns) → "1234.50".
 * Always 2 decimals so clients can compare strings and format consistently.
 */
export function toMoneyString(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(value).toFixed(2);
}

export function toNullableMoneyString(value: Prisma.Decimal | null): string | null {
  return value === null ? null : toMoneyString(value);
}
