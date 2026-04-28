import type { ContractAcceptanceSummary, CargoSize, PricingMode, QuoteInput, QuotePricing, QuoteValidation, RouteResult, SolarSystem } from "../types";
import { sanitizeApiText, sanitizeFiniteNumber, sanitizeHexColor, sanitizePositiveInteger, sanitizeSystemQuery } from "./guards";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";
const REQUEST_TIMEOUT_MS = 8_000;

type RouteResponse = {
  systems: number[];
  routeSystems: RouteResult["routeSystems"];
  routeTraffic?: RouteResult["routeTraffic"];
  jumps: number;
};

export type EsiStatus = {
  players: number;
  server_version: string;
  start_time: string;
  vip: boolean;
  fetched_at: string;
};

export async function fetchSystems(query: string, limit = 12): Promise<SolarSystem[]> {
  const params = new URLSearchParams({
    q: sanitizeSystemQuery(query),
    limit: String(limit),
  });
  const systems = await getJson<unknown[]>(`/api/eve/systems?${params.toString()}`);
  return systems.map((system) => normalizeSolarSystem(system));
}

export async function fetchEsiRoute(originId: number, destinationId: number): Promise<RouteResult> {
  const params = new URLSearchParams({
    originId: String(originId),
    destinationId: String(destinationId),
  });
  const route = await getJson<RouteResponse>(`/api/eve/route?${params.toString()}`);

  return {
    source: "esi",
    systems: Array.isArray(route.systems) ? route.systems.map((systemId) => sanitizePositiveInteger(systemId)) : [],
    routeSystems: Array.isArray(route.routeSystems) ? route.routeSystems.map(normalizeRouteSystem) : [],
    routeTraffic: route.routeTraffic ? {
      coverage: sanitizeFiniteNumber(route.routeTraffic.coverage),
      knownSystems: sanitizePositiveInteger(route.routeTraffic.knownSystems),
      ...normalizeRouteTrafficLevel(route.routeTraffic.level),
      totalShipJumpsLastHour: route.routeTraffic.totalShipJumpsLastHour === null
        ? null
        : sanitizePositiveInteger(route.routeTraffic.totalShipJumpsLastHour),
      totalSystems: sanitizePositiveInteger(route.routeTraffic.totalSystems),
    } : null,
    jumps: sanitizePositiveInteger(route.jumps),
  };
}

export async function fetchEsiStatus(): Promise<EsiStatus> {
  return getJson<EsiStatus>("/api/eve/status");
}

export async function fetchContractAcceptance(): Promise<ContractAcceptanceSummary> {
  const acceptance = await getJson<ContractAcceptanceSummary>("/api/solane/contract-acceptance");
  const acceptanceLevel = normalizeContractAcceptanceLevel(acceptance.level);
  return {
    isFresh: Boolean(acceptance.isFresh),
    label: acceptanceLevel.label,
    lastSyncedAt: acceptance.lastSyncedAt,
    level: acceptanceLevel.level,
    source: acceptance.source === "corp-contracts" ? "corp-contracts" : "syncing",
  };
}

export async function validateQuote(input: QuoteInput): Promise<QuoteValidation> {
  if (!input.pickup || !input.destination) {
    throw new Error("Quote validation requires endpoints.");
  }

  const validation = await postJson<QuoteValidation>("/api/solane/quote/validate", {
    collateral: input.collateral,
    destinationSystemId: input.destination.id,
    pickupSystemId: input.pickup.id,
    size: input.size,
  });

  return normalizeQuoteValidation(validation);
}

export async function fetchQuoteCalculation(input: QuoteInput): Promise<QuotePricing> {
  if (!input.pickup || !input.destination) {
    throw new Error("Quote calculation requires endpoints.");
  }

  const pricing = await postJson<QuotePricing>("/api/solane/quote/calculate", {
    collateral: input.collateral,
    destinationSystemId: input.destination.id,
    pickupSystemId: input.pickup.id,
    size: input.size,
    speed: input.speed,
  });

  return normalizeQuotePricing(pricing);
}

async function getJson<T>(path: string): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Invalid API path.");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    credentials: "omit",
    headers: {
      Accept: "application/json",
    },
    referrerPolicy: "no-referrer",
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Unexpected API response type.");
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Invalid API path.");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
    referrerPolicy: "no-referrer",
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Unexpected API response type.");
  }

  return response.json() as Promise<T>;
}

function normalizeSolarSystem(value: unknown): SolarSystem {
  const system = isRecord(value) ? value : {};
  return {
    color: sanitizeHexColor(system.color),
    constellationId: sanitizePositiveInteger(system.constellationId),
    id: sanitizePositiveInteger(system.id),
    name: sanitizeApiText(system.name),
    regionId: sanitizePositiveInteger(system.regionId),
    regionName: sanitizeApiText(system.regionName),
    securityDisplay: sanitizeApiText(system.securityDisplay),
    securityStatus: sanitizeFiniteNumber(system.securityStatus),
    serviceType: normalizeServiceType(system.serviceType),
  };
}

function normalizeRouteSystem(value: unknown): RouteResult["routeSystems"][number] {
  const system = isRecord(value) ? value : {};
  return {
    color: system.color ? sanitizeHexColor(system.color) : null,
    id: sanitizePositiveInteger(system.id),
    name: sanitizeApiText(system.name),
    securityDisplay: system.securityDisplay ? sanitizeApiText(system.securityDisplay) : null,
    serviceType: system.serviceType ? sanitizeApiText(system.serviceType) : null,
    shipJumpsLastHour: system.shipJumpsLastHour === null || system.shipJumpsLastHour === undefined
      ? null
      : sanitizePositiveInteger(system.shipJumpsLastHour),
  };
}

function normalizeRouteTrafficLevel(value: unknown): Pick<NonNullable<RouteResult["routeTraffic"]>, "label" | "level"> {
  if (value === "clear") {
    return { label: "Clear", level: "clear" };
  }
  if (value === "active") {
    return { label: "Active", level: "active" };
  }
  if (value === "busy") {
    return { label: "Busy", level: "busy" };
  }
  if (value === "heavy") {
    return { label: "Heavy", level: "heavy" };
  }
  return { label: "Unavailable", level: "unavailable" };
}

function normalizeContractAcceptanceLevel(value: unknown): Pick<ContractAcceptanceSummary, "label" | "level"> {
  if (value === "express") {
    return { label: "Express", level: "express" };
  }
  if (value === "fast") {
    return { label: "Fast", level: "fast" };
  }
  if (value === "normal") {
    return { label: "Normal", level: "normal" };
  }
  if (value === "slower") {
    return { label: "Slower", level: "slower" };
  }
  if (value === "extended") {
    return { label: "Extended", level: "extended" };
  }
  return { label: "Syncing", level: "syncing" };
}

function normalizeQuoteValidation(value: unknown): QuoteValidation {
  const validation = isRecord(value) ? value : {};
  const allowedSizes = Array.isArray(validation.allowedSizes)
    ? validation.allowedSizes.filter((size): size is CargoSize => isCargoSize(size))
    : [];

  return {
    allowedSizes,
    blockedReason: typeof validation.blockedReason === "string" ? sanitizeApiText(validation.blockedReason) : null,
    maxCollateral: sanitizePositiveInteger(validation.maxCollateral, 5_000_000_000),
    selectedSizeValid: Boolean(validation.selectedSizeValid),
    valid: Boolean(validation.valid),
  };
}

function normalizeQuotePricing(value: unknown): QuotePricing {
  const pricing = isRecord(value) ? value : {};
  const validation = normalizeQuoteValidation(pricing);
  const mode = normalizePricingMode(pricing.pricingMode);

  return {
    ...validation,
    currency: "ISK",
    pricingLabel: typeof pricing.pricingLabel === "string" ? sanitizeApiText(pricing.pricingLabel) : "Blocked",
    pricingMode: mode,
    reward: sanitizePositiveInteger(pricing.reward),
    routeJumps: pricing.routeJumps === null || pricing.routeJumps === undefined
      ? null
      : sanitizePositiveInteger(pricing.routeJumps),
  };
}

function normalizePricingMode(value: unknown): PricingMode {
  if (value === "fixed" || value === "per_jump" || value === "blocked") {
    return value;
  }
  return "blocked";
}

function isCargoSize(value: unknown): value is CargoSize {
  return value === "small" || value === "medium" || value === "freighter";
}

function normalizeServiceType(value: unknown): SolarSystem["serviceType"] {
  return value === "Pochven" || value === "Thera" || value === "HighSec" || value === "LowSec" || value === "Zarzakh"
    ? value
    : "HighSec";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
