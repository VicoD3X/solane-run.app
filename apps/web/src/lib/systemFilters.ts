import type { SolarSystem } from "../types";

const CALCULATOR_HIDDEN_SERVICE_TYPES = new Set<SolarSystem["serviceType"]>(["NpcNullSec"]);

export function isCalculatorSearchVisible(system: Pick<SolarSystem, "serviceType">): boolean {
  return !CALCULATOR_HIDDEN_SERVICE_TYPES.has(system.serviceType);
}
