export function formatIsk(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B ISK`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ISK`;
  }

  return `${Math.round(value).toLocaleString("en-US")} ISK`;
}

export function formatFullIsk(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} ISK`;
}

export function formatM3(value: number): string {
  return `${value.toLocaleString("en-US")} m3`;
}

export function formatIskInput(value: number): string {
  return groupDigitsWithSpaces(String(Math.round(value)));
}

export function formatIskInputText(value: string): string {
  const digits = sanitizeCollateralInput(value);
  if (!digits) {
    return "";
  }

  return groupDigitsWithSpaces(digits);
}

function groupDigitsWithSpaces(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function parseIskInput(value: string): number {
  const normalized = value.trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
  if (!normalized) {
    return 0;
  }

  const match = normalized.match(/^(\d+(?:\.\d+)?)(b|bn|bil|billion|m|mil|million)?(?:isk)?$/);
  if (!match) {
    const digitsOnly = Number(normalized.replace(/[^\d.]/g, ""));
    return Number.isFinite(digitsOnly) ? Math.round(digitsOnly) : 0;
  }

  const amount = Number(match[1]);
  const suffix = match[2];
  if (!Number.isFinite(amount)) {
    return 0;
  }

  if (suffix?.startsWith("b")) {
    return Math.round(amount * 1_000_000_000);
  }

  if (suffix?.startsWith("m")) {
    return Math.round(amount * 1_000_000);
  }

  return Math.round(amount);
}
import { sanitizeCollateralInput } from "./guards";
