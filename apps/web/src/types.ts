export type ServiceType = "Pochven" | "Thera" | "HighSec" | "LowSec" | "Zarzakh";

export type SolarSystem = {
  id: number;
  name: string;
  securityStatus: number;
  securityDisplay: string;
  regionId: number;
  regionName: string;
  constellationId: number;
  serviceType: ServiceType;
  color: string;
};

export type QuoteInput = {
  pickup: SolarSystem | null;
  destination: SolarSystem | null;
  size: CargoSize;
  speed: RunSpeed;
  volume: number;
  collateral: number;
};

export type CargoSize = "small" | "medium" | "freighter";

export type RunSpeed = "normal" | "rush";

export type QuoteValidation = {
  valid: boolean;
  allowedSizes: CargoSize[];
  selectedSizeValid: boolean;
  blockedReason: string | null;
  maxCollateral: number;
};

export type PricingMode = "fixed" | "per_jump" | "blocked";

export type QuotePricing = QuoteValidation & {
  reward: number;
  currency: "ISK";
  pricingMode: PricingMode;
  pricingLabel: string;
  routeJumps: number | null;
};

export type RouteSystem = {
  id: number;
  name: string;
  securityDisplay?: string | null;
  serviceType?: string | null;
  color?: string | null;
  shipJumpsLastHour?: number | null;
};

export type RouteTrafficSummary = {
  totalShipJumpsLastHour: number | null;
  knownSystems: number;
  totalSystems: number;
  coverage: number;
  level: "clear" | "active" | "busy" | "heavy" | "unavailable";
  label: "Clear" | "Active" | "Busy" | "Heavy" | "Unavailable";
};

export type ContractAcceptanceLevel = "express" | "fast" | "normal" | "slower" | "extended" | "syncing";

export type ContractAcceptanceSummary = {
  level: ContractAcceptanceLevel;
  label: "Express" | "Fast" | "Normal" | "Slower" | "Extended" | "Syncing";
  lastSyncedAt: string | null;
  isFresh: boolean;
  source: "corp-contracts" | "syncing";
};

export type RouteResult = {
  systems: number[];
  routeSystems: RouteSystem[];
  routeTraffic?: RouteTrafficSummary | null;
  jumps: number;
  source: "esi" | "local";
};

export type QuoteResult = {
  route: RouteResult;
  estimate: number;
  blockedReason?: string;
  currency: "ISK";
  pricingLabel: string;
  pricingMode: PricingMode;
  source: "api" | "local";
};
