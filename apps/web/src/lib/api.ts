import type {
  CargoSize,
  CorruptionIntelDetail,
  CorruptionIntelItem,
  CrossroadsIntelDetail,
  GatecheckGate,
  GatecheckKillmail,
  GoldIntelDetail,
  GoldIntelItem,
  PricingMode,
  QuoteInput,
  QuotePricing,
  QuoteValidation,
  RouteIntelOverview,
  RouteIntelSeverity,
  RouteIntelStatus,
  RouteIntelSystemRef,
  RouteResult,
  ServiceWindowSummary,
  SolarSystem,
  ZkillIntelSummary,
  ZkillKillmailSummary,
} from "../types";
import { sanitizeApiText, sanitizeFiniteNumber, sanitizeHexColor, sanitizePositiveInteger, sanitizeSystemQuery } from "./guards";
import { isCalculatorSearchVisible } from "./systemFilters";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";
const REQUEST_TIMEOUT_MS = 8_000;

type RouteResponse = {
  systems: number[];
  routeSystems: RouteResult["routeSystems"];
  routeTraffic?: RouteResult["routeTraffic"];
  routeRisk?: RouteResult["routeRisk"];
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
  const apiLimit = Math.max(limit, 24);
  const params = new URLSearchParams({
    q: sanitizeSystemQuery(query),
    limit: String(apiLimit),
  });
  const systems = await getJson<unknown[]>(`/api/eve/systems?${params.toString()}`);
  return systems
    .map((system) => normalizeSolarSystem(system))
    .filter(isCalculatorSearchVisible)
    .slice(0, limit);
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
      totalPodKillsLastHour: route.routeTraffic.totalPodKillsLastHour === null || route.routeTraffic.totalPodKillsLastHour === undefined
        ? null
        : sanitizePositiveInteger(route.routeTraffic.totalPodKillsLastHour),
      totalShipKillsLastHour: route.routeTraffic.totalShipKillsLastHour === null || route.routeTraffic.totalShipKillsLastHour === undefined
        ? null
        : sanitizePositiveInteger(route.routeTraffic.totalShipKillsLastHour),
      totalShipJumpsLastHour: route.routeTraffic.totalShipJumpsLastHour === null
        ? null
        : sanitizePositiveInteger(route.routeTraffic.totalShipJumpsLastHour),
      totalSystems: sanitizePositiveInteger(route.routeTraffic.totalSystems),
    } : null,
    routeRisk: normalizeRouteRisk(route.routeRisk),
    jumps: sanitizePositiveInteger(route.jumps),
  };
}

export async function fetchEsiStatus(): Promise<EsiStatus> {
  return getJson<EsiStatus>("/api/eve/status");
}

export async function fetchServiceWindow(): Promise<ServiceWindowSummary> {
  const serviceWindow = await getJson<ServiceWindowSummary>("/api/solane/service-window");
  const serviceLevel = normalizeServiceWindowLevel(serviceWindow.level);
  return {
    detail: normalizeServiceWindowDetail(serviceWindow.detail),
    isFresh: Boolean(serviceWindow.isFresh),
    label: serviceLevel.label,
    lastSyncedAt: serviceWindow.lastSyncedAt,
    level: serviceLevel.level,
    source: "schedule",
  };
}

export async function fetchRouteIntelOverview(): Promise<RouteIntelOverview> {
  const overview = await getJson<unknown>("/api/route-intel/overview");
  return normalizeRouteIntelOverview(overview);
}

export async function fetchGoldIntelDetail(routeId: string): Promise<GoldIntelDetail> {
  const detail = await getJson<unknown>(`/api/route-intel/gold/${encodeURIComponent(routeId)}`);
  return normalizeGoldIntelDetail(detail);
}

export async function fetchCorruptionIntelDetail(systemId: number): Promise<CorruptionIntelDetail> {
  const detail = await getJson<unknown>(`/api/route-intel/corruption/${sanitizePositiveInteger(systemId)}`);
  return normalizeCorruptionIntelDetail(detail);
}

export async function fetchCrossroadsIntelDetail(systemId: number): Promise<CrossroadsIntelDetail> {
  const detail = await getJson<unknown>(`/api/route-intel/crossroads/${sanitizePositiveInteger(systemId)}`);
  return normalizeCrossroadsIntelDetail(detail);
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
    podKillsLastHour: system.podKillsLastHour === null || system.podKillsLastHour === undefined
      ? null
      : sanitizePositiveInteger(system.podKillsLastHour),
    shipKillsLastHour: system.shipKillsLastHour === null || system.shipKillsLastHour === undefined
      ? null
      : sanitizePositiveInteger(system.shipKillsLastHour),
    shipJumpsLastHour: system.shipJumpsLastHour === null || system.shipJumpsLastHour === undefined
      ? null
      : sanitizePositiveInteger(system.shipJumpsLastHour),
    zkillIntel: normalizeZkillIntel(system.zkillIntel),
  };
}

function normalizeRouteTrafficLevel(value: unknown): Pick<NonNullable<RouteResult["routeTraffic"]>, "label" | "level"> {
  if (value === "clear") {
    return { label: "Clear", level: "clear" };
  }
  if (value === "active") {
    return { label: "Active", level: "active" };
  }
  if (value === "moderate") {
    return { label: "Moderate", level: "moderate" };
  }
  if (value === "busy") {
    return { label: "Busy", level: "busy" };
  }
  if (value === "heavy") {
    return { label: "Heavy", level: "heavy" };
  }
  return { label: "Unavailable", level: "unavailable" };
}

function normalizeRouteRisk(value: unknown): RouteResult["routeRisk"] {
  if (!value || !isRecord(value)) {
    return null;
  }
  const riskLevel = normalizeRouteRiskLevel(value.level);
  const affectedSystems = Array.isArray(value.affectedSystems)
    ? value.affectedSystems.map((system) => {
        const item = isRecord(system) ? system : {};
        return {
          id: sanitizePositiveInteger(item.id),
          name: sanitizeApiText(item.name),
        };
      }).filter((system) => system.id > 0 && system.name.length > 0)
    : [];

  return {
    affectedSystems,
    confidence: normalizeRouteRiskConfidence(value.confidence),
    isBlocking: Boolean(value.isBlocking),
    label: riskLevel.label,
    lastSyncedAt: typeof value.lastSyncedAt === "string" ? sanitizeApiText(value.lastSyncedAt) : null,
    level: riskLevel.level,
    lowSecShipKillsLastHour: value.lowSecShipKillsLastHour === null || value.lowSecShipKillsLastHour === undefined
      ? null
      : sanitizePositiveInteger(value.lowSecShipKillsLastHour),
    reason: typeof value.reason === "string" ? sanitizeApiText(value.reason) : null,
    riskSource: normalizeRouteRiskSource(value.riskSource),
    routeStandard: value.routeStandard === "golden" ? "golden" : "standard",
    routeStandardLabel: value.routeStandard === "golden" ? "Golden Standard" : "Standard Route",
    trend: normalizeRouteRiskTrend(value.trend),
  };
}

function normalizeRouteRiskLevel(value: unknown): Pick<NonNullable<RouteResult["routeRisk"]>, "label" | "level"> {
  if (value === "nominal") {
    return { label: "Nominal", level: "nominal" };
  }
  if (value === "watched") {
    return { label: "Watched", level: "watched" };
  }
  if (value === "hot") {
    return { label: "Hot", level: "hot" };
  }
  if (value === "flashpoint") {
    return { label: "Flashpoint", level: "flashpoint" };
  }
  if (value === "critical") {
    return { label: "Critical", level: "critical" };
  }
  return { label: "Unavailable", level: "unavailable" };
}

function normalizeRouteRiskConfidence(value: unknown): NonNullable<RouteResult["routeRisk"]>["confidence"] {
  if (value === "live" || value === "partial" || value === "calibrating" || value === "unavailable") {
    return value;
  }
  return "unavailable";
}

function normalizeRouteRiskTrend(value: unknown): NonNullable<RouteResult["routeRisk"]>["trend"] {
  if (value === "stable" || value === "recurrent" || value === "volatile" || value === "unavailable") {
    return value;
  }
  return null;
}

function normalizeRouteRiskSource(value: unknown): NonNullable<RouteResult["routeRisk"]>["riskSource"] {
  if (
    value === "none" ||
    value === "static" ||
    value === "insurgency" ||
    value === "live_pvp" ||
    value === "mixed" ||
    value === "unavailable"
  ) {
    return value;
  }
  return "none";
}

function normalizeServiceWindowLevel(value: unknown): Pick<ServiceWindowSummary, "label" | "level"> {
  if (value === "low_activity") {
    return { label: "Low Activity", level: "low_activity" };
  }
  if (value === "medium_activity" || value === "variable_activity") {
    return { label: "Medium Activity", level: "medium_activity" };
  }
  if (value === "high_activity") {
    return { label: "High Activity", level: "high_activity" };
  }
  return { label: "Medium Activity", level: "medium_activity" };
}

function normalizeServiceWindowDetail(value: unknown): ServiceWindowSummary["detail"] {
  if (value === "Night EUTZ" || value === "Day EUTZ" || value === "Prime EUTZ") {
    return value;
  }
  return "Day EUTZ";
}

function normalizeQuoteValidation(value: unknown): QuoteValidation {
  const validation = isRecord(value) ? value : {};
  const allowedSizes = Array.isArray(validation.allowedSizes)
    ? validation.allowedSizes.filter((size): size is CargoSize => isCargoSize(size))
    : [];

  return {
    allowedSizes,
    blockedCode: normalizeBlockedCode(validation.blockedCode),
    blockedReason: typeof validation.blockedReason === "string" ? sanitizeApiText(validation.blockedReason) : null,
    maxCollateral: sanitizePositiveInteger(validation.maxCollateral, 6_000_000_000),
    risk: normalizeRouteRisk(validation.risk),
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

function normalizeRouteIntelOverview(value: unknown): RouteIntelOverview {
  const overview = isRecord(value) ? value : {};
  return {
    corruption: normalizeCorruptionIntel(overview.corruption),
    crossroads: normalizeCrossroadsIntel(overview.crossroads),
    donationCharacter: sanitizeApiText(overview.donationCharacter, "Vito Solane"),
    gold: normalizeGoldIntel(overview.gold),
  };
}

function normalizeCrossroadsIntel(value: unknown): RouteIntelOverview["crossroads"] {
  const section = isRecord(value) ? value : {};
  return {
    items: Array.isArray(section.items) ? section.items.map(normalizeCrossroadsIntelItem) : [],
    label: sanitizeApiText(section.label, "Watchlist pending"),
    status: normalizeRouteIntelStatus(section.status),
    summary: sanitizeApiText(section.summary, "Crossroads watchlist pending."),
  };
}

function normalizeGoldIntel(value: unknown): RouteIntelOverview["gold"] {
  const section = isRecord(value) ? value : {};
  return {
    items: Array.isArray(section.items) ? section.items.map(normalizeGoldIntelItem) : [],
    label: sanitizeApiText(section.label, "Golden routes"),
    status: normalizeRouteIntelStatus(section.status),
    summary: sanitizeApiText(section.summary, "Manually reviewed Solane corridors."),
  };
}

function normalizeCorruptionIntel(value: unknown): RouteIntelOverview["corruption"] {
  const section = isRecord(value) ? value : {};
  return {
    items: Array.isArray(section.items) ? section.items.map(normalizeCorruptionIntelItem) : [],
    label: sanitizeApiText(section.label, "0 LVL4 / 0 LVL5"),
    status: normalizeRouteIntelStatus(section.status),
    summary: sanitizeApiText(section.summary, "Insurgency corruption telemetry."),
  };
}

function normalizeCrossroadsIntelItem(value: unknown): RouteIntelOverview["crossroads"]["items"][number] {
  const item = isRecord(value) ? value : {};
  return {
    gateCount: item.gateCount === null || item.gateCount === undefined ? null : sanitizePositiveInteger(item.gateCount),
    distanceFromJita: item.distanceFromJita === null || item.distanceFromJita === undefined ? null : sanitizePositiveInteger(item.distanceFromJita),
    label: sanitizeApiText(item.label, "Pending"),
    podKillsLastHour: item.podKillsLastHour === null || item.podKillsLastHour === undefined ? null : sanitizePositiveInteger(item.podKillsLastHour),
    severity: normalizeRouteIntelSeverity(item.severity),
    shipJumpsLastHour: item.shipJumpsLastHour === null || item.shipJumpsLastHour === undefined ? null : sanitizePositiveInteger(item.shipJumpsLastHour),
    shipKillsLastHour: item.shipKillsLastHour === null || item.shipKillsLastHour === undefined ? null : sanitizePositiveInteger(item.shipKillsLastHour),
    summary: sanitizeApiText(item.summary, "Awaiting intel."),
    system: normalizeRouteIntelSystemRef(item.system),
    zkillIntel: normalizeZkillIntel(item.zkillIntel),
  };
}

function normalizeGoldIntelItem(value: unknown): GoldIntelItem {
  const item = isRecord(value) ? value : {};
  return {
    destination: normalizeRouteIntelSystemRef(item.destination),
    label: sanitizeApiText(item.label, "Golden route"),
    origin: normalizeRouteIntelSystemRef(item.origin),
    routeId: sanitizeApiText(item.routeId),
    status: normalizeRouteIntelStatus(item.status),
  };
}

function normalizeCorruptionIntelItem(value: unknown): CorruptionIntelItem {
  const item = isRecord(value) ? value : {};
  return {
    corruptionPercentage: sanitizeFiniteNumber(item.corruptionPercentage),
    corruptionState: sanitizePositiveInteger(item.corruptionState),
    factionId: item.factionId === null || item.factionId === undefined ? null : sanitizePositiveInteger(item.factionId),
    label: sanitizeApiText(item.label, "Corruption"),
    originSystemId: item.originSystemId === null || item.originSystemId === undefined ? null : sanitizePositiveInteger(item.originSystemId),
    severity: normalizeRouteIntelSeverity(item.severity),
    suppressionPercentage: sanitizeFiniteNumber(item.suppressionPercentage),
    suppressionState: sanitizePositiveInteger(item.suppressionState),
    system: normalizeRouteIntelSystemRef(item.system),
    zkillIntel: normalizeZkillIntel(item.zkillIntel),
  };
}

function normalizeGoldIntelDetail(value: unknown): GoldIntelDetail {
  const detail = isRecord(value) ? value : {};
  const traffic = isRecord(detail.routeTraffic) ? detail.routeTraffic : null;
  return {
    destination: normalizeRouteIntelSystemRef(detail.destination),
    flag: normalizeRouteFlag(detail.flag),
    jumps: sanitizePositiveInteger(detail.jumps),
    origin: normalizeRouteIntelSystemRef(detail.origin),
    routeId: sanitizeApiText(detail.routeId),
    routeRisk: normalizeRouteRisk(detail.routeRisk),
    routeTraffic: traffic ? {
      coverage: sanitizeFiniteNumber(traffic.coverage),
      knownSystems: sanitizePositiveInteger(traffic.knownSystems),
      ...normalizeRouteTrafficLevel(traffic.level),
      totalPodKillsLastHour: traffic.totalPodKillsLastHour === null || traffic.totalPodKillsLastHour === undefined
        ? null
        : sanitizePositiveInteger(traffic.totalPodKillsLastHour),
      totalShipKillsLastHour: traffic.totalShipKillsLastHour === null || traffic.totalShipKillsLastHour === undefined
        ? null
        : sanitizePositiveInteger(traffic.totalShipKillsLastHour),
      totalShipJumpsLastHour: traffic.totalShipJumpsLastHour === null || traffic.totalShipJumpsLastHour === undefined
        ? null
        : sanitizePositiveInteger(traffic.totalShipJumpsLastHour),
      totalSystems: sanitizePositiveInteger(traffic.totalSystems),
    } : null,
    systems: Array.isArray(detail.systems) ? detail.systems.map(normalizeRouteSystem) : [],
    zkillIntel: normalizeZkillIntel(detail.zkillIntel),
  };
}

function normalizeCorruptionIntelDetail(value: unknown): CorruptionIntelDetail {
  const detail = isRecord(value) ? value : {};
  return {
    ...normalizeCorruptionIntelItem(detail),
    gates: Array.isArray(detail.gates) ? detail.gates.map(normalizeGatecheckGate) : [],
    podKillsLastHour: detail.podKillsLastHour === null || detail.podKillsLastHour === undefined ? null : sanitizePositiveInteger(detail.podKillsLastHour),
    shipJumpsLastHour: detail.shipJumpsLastHour === null || detail.shipJumpsLastHour === undefined ? null : sanitizePositiveInteger(detail.shipJumpsLastHour),
    shipKillsLastHour: detail.shipKillsLastHour === null || detail.shipKillsLastHour === undefined ? null : sanitizePositiveInteger(detail.shipKillsLastHour),
    summary: sanitizeApiText(detail.summary, "Corruption intel unavailable."),
  };
}

function normalizeCrossroadsIntelDetail(value: unknown): CrossroadsIntelDetail {
  const detail = isRecord(value) ? value : {};
  return {
    gates: Array.isArray(detail.gates) ? detail.gates.map(normalizeGatecheckGate) : [],
    status: normalizeRouteIntelStatus(detail.status),
    summary: sanitizeApiText(detail.summary, "Crossroads watchlist pending."),
    system: detail.system ? normalizeRouteIntelSystemRef(detail.system) : null,
    distanceFromJita: detail.distanceFromJita === null || detail.distanceFromJita === undefined ? null : sanitizePositiveInteger(detail.distanceFromJita),
    label: sanitizeApiText(detail.label, "Pending"),
    podKillsLastHour: detail.podKillsLastHour === null || detail.podKillsLastHour === undefined ? null : sanitizePositiveInteger(detail.podKillsLastHour),
    severity: normalizeRouteIntelSeverity(detail.severity),
    shipJumpsLastHour: detail.shipJumpsLastHour === null || detail.shipJumpsLastHour === undefined ? null : sanitizePositiveInteger(detail.shipJumpsLastHour),
    shipKillsLastHour: detail.shipKillsLastHour === null || detail.shipKillsLastHour === undefined ? null : sanitizePositiveInteger(detail.shipKillsLastHour),
    zkillIntel: normalizeZkillIntel(detail.zkillIntel),
  };
}

function normalizeGatecheckGate(value: unknown): GatecheckGate {
  const gate = isRecord(value) ? value : {};
  return {
    destinationSystemId: gate.destinationSystemId === null || gate.destinationSystemId === undefined ? null : sanitizePositiveInteger(gate.destinationSystemId),
    destinationSystemName: gate.destinationSystemName === null || gate.destinationSystemName === undefined ? null : sanitizeApiText(gate.destinationSystemName),
    id: sanitizePositiveInteger(gate.id),
    killmails: Array.isArray(gate.killmails) ? gate.killmails.map(normalizeGatecheckKillmail).slice(0, 8) : [],
    killsLastHour: sanitizePositiveInteger(gate.killsLastHour),
    name: sanitizeApiText(gate.name, "Unknown gate"),
  };
}

function normalizeGatecheckKillmail(value: unknown): GatecheckKillmail {
  const killmail = isRecord(value) ? value : {};
  return {
    killmailId: sanitizePositiveInteger(killmail.killmailId),
    labels: Array.isArray(killmail.labels) ? killmail.labels.map((label) => sanitizeApiText(label)).filter(Boolean).slice(0, 8) : [],
    locationId: killmail.locationId === null || killmail.locationId === undefined ? null : sanitizePositiveInteger(killmail.locationId),
    totalValue: sanitizePositiveInteger(killmail.totalValue),
  };
}

function normalizeRouteIntelSystemRef(value: unknown): RouteIntelSystemRef {
  const system = isRecord(value) ? value : {};
  return {
    color: system.color ? sanitizeHexColor(system.color) : null,
    id: sanitizePositiveInteger(system.id),
    name: sanitizeApiText(system.name, "Unknown"),
    securityDisplay: system.securityDisplay ? sanitizeApiText(system.securityDisplay) : null,
    serviceType: system.serviceType ? sanitizeApiText(system.serviceType) : null,
  };
}

function normalizeRouteIntelStatus(value: unknown): RouteIntelStatus {
  if (value === "ready" || value === "watchlist_pending" || value === "calibrating" || value === "unavailable") {
    return value;
  }
  return "unavailable";
}

function normalizeRouteIntelSeverity(value: unknown): RouteIntelSeverity {
  if (value === "safe" || value === "watched" || value === "active_gank" || value === "severe" || value === "restricted" || value === "unavailable" || value === "pending") {
    return value;
  }
  return "unavailable";
}

function normalizeZkillIntel(value: unknown): ZkillIntelSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  const status: ZkillIntelSummary["status"] = value.status === "ready" ? "ready" : "unavailable";
  return {
    fetchedAt: value.fetchedAt === null || value.fetchedAt === undefined ? null : sanitizeApiText(value.fetchedAt),
    highValueKillmailCount: sanitizePositiveInteger(value.highValueKillmailCount),
    killmailCount: sanitizePositiveInteger(value.killmailCount),
    labels: Array.isArray(value.labels) ? value.labels.map((label) => sanitizeApiText(label)).filter(Boolean).slice(0, 8) : [],
    latestKillmailAt: value.latestKillmailAt === null || value.latestKillmailAt === undefined ? null : sanitizeApiText(value.latestKillmailAt),
    pvpKillmailCount: sanitizePositiveInteger(value.pvpKillmailCount),
    recentKillmails: Array.isArray(value.recentKillmails) ? value.recentKillmails.map(normalizeZkillKillmail).slice(0, 8) : [],
    status,
    totalValue: sanitizePositiveInteger(value.totalValue),
  };
}

function normalizeZkillKillmail(value: unknown): ZkillKillmailSummary {
  const killmail = isRecord(value) ? value : {};
  return {
    destroyedValue: killmail.destroyedValue === null || killmail.destroyedValue === undefined ? null : sanitizePositiveInteger(killmail.destroyedValue),
    droppedValue: killmail.droppedValue === null || killmail.droppedValue === undefined ? null : sanitizePositiveInteger(killmail.droppedValue),
    killmailId: sanitizePositiveInteger(killmail.killmailId),
    labels: Array.isArray(killmail.labels) ? killmail.labels.map((label) => sanitizeApiText(label)).filter(Boolean).slice(0, 8) : [],
    locationId: killmail.locationId === null || killmail.locationId === undefined ? null : sanitizePositiveInteger(killmail.locationId),
    npc: typeof killmail.npc === "boolean" ? killmail.npc : null,
    solo: typeof killmail.solo === "boolean" ? killmail.solo : null,
    totalValue: sanitizePositiveInteger(killmail.totalValue),
  };
}

function normalizeRouteFlag(value: unknown): GoldIntelDetail["flag"] {
  if (value === "shortest" || value === "secure" || value === "insecure") {
    return value;
  }
  return "secure";
}

function normalizePricingMode(value: unknown): PricingMode {
  if (value === "fixed" || value === "per_jump" || value === "hybrid" || value === "blocked") {
    return value;
  }
  return "blocked";
}

function normalizeBlockedCode(value: unknown): QuoteValidation["blockedCode"] {
  if (
    value === "missing_collateral" ||
    value === "minimum_collateral" ||
    value === "collateral_limit" ||
    value === "size_unavailable" ||
    value === "speed_unavailable" ||
    value === "risk_restricted" ||
    value === "route_unavailable" ||
    value === "pricing_unavailable"
  ) {
    return value;
  }
  return null;
}

function isCargoSize(value: unknown): value is CargoSize {
  return value === "small" || value === "medium";
}

function normalizeServiceType(value: unknown): SolarSystem["serviceType"] {
  return value === "Pochven" || value === "Thera" || value === "HighSec" || value === "LowSec" || value === "NpcNullSec" || value === "Zarzakh"
    ? value
    : "HighSec";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
