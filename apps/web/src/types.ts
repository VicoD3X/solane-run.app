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

export type RouteSystem = {
  id: number;
  name: string;
  securityDisplay?: string | null;
  serviceType?: string | null;
  color?: string | null;
  shipJumpsLastHour?: number | null;
};

export type RouteResult = {
  systems: number[];
  routeSystems: RouteSystem[];
  jumps: number;
  source: "esi" | "local";
};

export type QuoteResult = {
  route: RouteResult;
  estimate: number;
};
