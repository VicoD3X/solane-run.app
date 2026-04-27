import type { RouteResult, SolarSystem } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";

type RouteResponse = {
  systems: number[];
  routeSystems: RouteResult["routeSystems"];
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
    q: query,
    limit: String(limit),
  });
  return getJson<SolarSystem[]>(`/api/eve/systems?${params.toString()}`);
}

export async function fetchEsiRoute(originId: number, destinationId: number): Promise<RouteResult> {
  const params = new URLSearchParams({
    originId: String(originId),
    destinationId: String(destinationId),
  });
  const route = await getJson<RouteResponse>(`/api/eve/route?${params.toString()}`);

  return {
    source: "esi",
    systems: route.systems,
    routeSystems: route.routeSystems,
    jumps: route.jumps,
  };
}

export async function fetchEsiStatus(): Promise<EsiStatus> {
  return getJson<EsiStatus>("/api/eve/status");
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}
