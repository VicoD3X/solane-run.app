import type { CargoSize, QuoteInput, QuotePricing, QuoteResult, QuoteValidation, RouteResult, RunSpeed, ServiceType } from "../types";

export const DEFAULT_COLLATERAL_VALUE = 6_000_000_000;
export const MAX_COLLATERAL_VALUE = 6_000_000_000;
export const LOWSEC_COLLATERAL_VALUE = 4_000_000_000;

export type CargoSizeOption = {
  disabled?: boolean;
  label: string;
  value: CargoSize;
  volume: number;
};

export type CollateralValidation = {
  limit: number;
  message: string | null;
  valid: boolean;
};

export const cargoSizes: CargoSizeOption[] = [
  { label: "13,000 m3", value: "small", volume: 13_000 },
  { label: "60,000 m3", value: "medium", volume: 60_000 },
];

const cargoSizeOrder: CargoSize[] = cargoSizes.map((option) => option.value);
const cargoSizesByService: Record<ServiceType, CargoSize[]> = {
  HighSec: ["small", "medium"],
  LowSec: ["small"],
  NpcNullSec: [],
  Pochven: ["small", "medium"],
  Thera: ["small", "medium"],
  Zarzakh: ["small", "medium"],
};

export const runSpeeds: { label: string; summaryLabel: string; value: RunSpeed }[] = [
  { label: "NORMAL", summaryLabel: "Normal", value: "normal" },
  { label: "RUSH", summaryLabel: "Rush", value: "rush" },
];

export function volumeForSize(size: CargoSize) {
  return cargoSizes.find((option) => option.value === size)?.volume ?? cargoSizes[0].volume;
}

export function labelForSize(size: CargoSize) {
  return cargoSizes.find((option) => option.value === size)?.label ?? cargoSizes[0].label;
}

export function labelForSpeed(speed: RunSpeed) {
  return runSpeeds.find((option) => option.value === speed)?.summaryLabel ?? runSpeeds[0].summaryLabel;
}

export function availableCargoSizesForQuote(
  input: Pick<QuoteInput, "pickup" | "destination" | "size" | "collateral">,
  validation = fallbackQuoteValidation(input),
): CargoSizeOption[] {
  const allowedSizes = new Set(validation.allowedSizes);

  return cargoSizes.map((option) => ({
    ...option,
    disabled: !allowedSizes.has(option.value),
  }));
}

export function fallbackQuoteValidation(
  input: Pick<QuoteInput, "pickup" | "destination" | "size" | "collateral">,
): QuoteValidation {
  const allowedSizes = allowedCargoSizeValues(input);
  const selectedSizeValid = allowedSizes.includes(input.size);
  const maxCollateral = fallbackCollateralLimit(input);
  const collateralValid = input.collateral <= maxCollateral;

  let blockedReason: string | null = null;
  let blockedCode: QuoteValidation["blockedCode"] = null;
  if (!selectedSizeValid) {
    blockedReason = "Selected cargo size is not available for this route.";
    blockedCode = "size_unavailable";
  } else if (!collateralValid) {
    blockedReason = `Collateral limit exceeded. Maximum allowed is ${maxCollateral.toLocaleString("en-US")} ISK.`;
    blockedCode = "collateral_limit";
  }

  return {
    allowedSizes,
    blockedCode,
    blockedReason,
    maxCollateral,
    selectedSizeValid,
    valid: selectedSizeValid && collateralValid,
  };
}

export function largestAllowedCargoSize(validation: QuoteValidation): CargoSize {
  return [...cargoSizeOrder].reverse().find((size) => validation.allowedSizes.includes(size)) ?? cargoSizes[0].value;
}

export function collateralLimitForQuote(
  input: Pick<QuoteInput, "pickup" | "destination" | "size" | "collateral">,
  validation = fallbackQuoteValidation(input),
): number {
  return Math.min(MAX_COLLATERAL_VALUE, validation.maxCollateral);
}

export function validateCollateral(input: QuoteInput, validation = fallbackQuoteValidation(input)): CollateralValidation {
  const limit = collateralLimitForQuote(input, validation);
  const valid = input.collateral <= limit;

  return {
    limit,
    valid,
    message: valid ? null : `Collateral limit exceeded. Maximum allowed is ${limit.toLocaleString("en-US")} ISK.`,
  };
}

function selectedServices(input: Pick<QuoteInput, "pickup" | "destination">): ServiceType[] {
  return [input.pickup?.serviceType, input.destination?.serviceType].filter((service): service is ServiceType =>
    Boolean(service),
  );
}

function allowedCargoSizeValues(input: Pick<QuoteInput, "pickup" | "destination">): CargoSize[] {
  const services = selectedServices(input);
  if (services.length === 0) {
    return cargoSizeOrder;
  }

  const allowedSizes = services.reduce<Set<CargoSize> | null>((currentAllowed, service) => {
    const nextAllowed = new Set(cargoSizesByService[service]);
    if (!currentAllowed) {
      return nextAllowed;
    }

    return new Set([...currentAllowed].filter((size) => nextAllowed.has(size)));
  }, null);

  return cargoSizeOrder.filter((size) => allowedSizes?.has(size));
}

function fallbackCollateralLimit(input: Pick<QuoteInput, "pickup" | "destination" | "size">): number {
  const services = selectedServices(input);
  if (services.length === 0) {
    return MAX_COLLATERAL_VALUE;
  }

  return Math.min(...services.map((service) => fallbackCollateralLimitForService(service, input.size)));
}

function fallbackCollateralLimitForService(service: ServiceType, size: CargoSize): number {
  if (size !== "small") {
    return MAX_COLLATERAL_VALUE;
  }
  if (service === "LowSec") {
    return LOWSEC_COLLATERAL_VALUE;
  }
  if (service === "Thera" || service === "Zarzakh") {
    return MAX_COLLATERAL_VALUE;
  }
  return MAX_COLLATERAL_VALUE;
}

export function fallbackRoute(input: QuoteInput): RouteResult {
  return {
    source: "local",
    systems: [input.pickup?.id, input.destination?.id].filter((id): id is number => Boolean(id)),
    routeSystems: [input.pickup, input.destination].filter((system): system is NonNullable<typeof system> => Boolean(system)),
    jumps: 0,
  };
}

export function calculateQuote(input: QuoteInput, route: RouteResult, validation = fallbackQuoteValidation(input)): QuoteResult {
  if (!validation.valid) {
    return {
      route,
      estimate: 0,
      risk: validation.risk ?? route.routeRisk ?? null,
      blockedReason: validation.blockedReason ?? "Quote blocked by Solane Engine guardrails.",
      blockedCode: validation.blockedCode ?? "pricing_unavailable",
      currency: "ISK",
      pricingLabel: "Blocked",
      pricingMode: "blocked",
      source: "local",
    };
  }

  if (input.pickup && input.destination) {
    return {
      route,
      estimate: 0,
      risk: validation.risk ?? route.routeRisk ?? null,
      blockedReason: "Pricing sync unavailable.",
      blockedCode: "pricing_unavailable",
      currency: "ISK",
      pricingLabel: "Blocked",
      pricingMode: "blocked",
      source: "local",
    };
  }

  return {
    route,
    estimate: 0,
    risk: validation.risk ?? route.routeRisk ?? null,
    currency: "ISK",
    pricingLabel: "Awaiting endpoints",
    pricingMode: "blocked",
    source: "local",
  };
}

export function quoteFromPricing(route: RouteResult, pricing: QuotePricing): QuoteResult {
  return {
    route,
    estimate: pricing.reward,
    risk: pricing.risk ?? route.routeRisk ?? null,
    blockedCode: pricing.blockedCode ?? undefined,
    blockedReason: pricing.blockedReason ?? undefined,
    currency: pricing.currency,
    pricingLabel: pricing.pricingLabel,
    pricingMode: pricing.pricingMode,
    source: "api",
  };
}
