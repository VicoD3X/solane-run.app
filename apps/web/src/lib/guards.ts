const MAX_SYSTEM_QUERY_LENGTH = 64;
const MAX_API_STRING_LENGTH = 96;

export function sanitizeSystemQuery(value: string): string {
  return value
    .replace(/\d/g, "")
    .replace(/[<>`"'{}[\]\\]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, MAX_SYSTEM_QUERY_LENGTH);
}

export function sanitizeCollateralInput(value: string): string {
  return value.replace(/\D/g, "");
}

export function sanitizeApiText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127 && !'<>`{}[]\\'.includes(character);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_API_STRING_LENGTH);
}

export function sanitizeHexColor(value: unknown, fallback = "#19a8ff"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : fallback;
}

export function sanitizeFiniteNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function sanitizePositiveInteger(value: unknown, fallback = 0): number {
  const numberValue = Math.trunc(sanitizeFiniteNumber(value, fallback));
  return numberValue >= 0 ? numberValue : fallback;
}
