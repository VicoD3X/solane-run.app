import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { AppShell } from "./components/AppShell";
import { DataPanel } from "./components/DataPanel";
import { QuotePanel } from "./components/QuotePanel";
import { RouteIntelPage } from "./components/RouteIntelPage";
import { RouteOverview } from "./components/RouteOverview";
import { SystemAutocomplete } from "./components/SystemAutocomplete";
import { Input } from "./components/ui/Input";
import { SegmentedControl } from "./components/ui/SegmentedControl";
import {
  availableCargoSizesForQuote,
  calculateQuote,
  cargoSizes,
  fallbackRoute,
  fallbackQuoteValidation,
  labelForSpeed,
  largestAllowedCargoSize,
  quoteFromPricing,
  validateCollateral,
  volumeForSize,
} from "./data/quote";
import { fetchEsiRoute, fetchQuoteCalculation, fetchServiceWindow } from "./lib/api";
import { formatIskInput, formatIskInputText, parseIskInput } from "./lib/format";
import type { CargoSize, QuoteInput, QuotePricing, QuoteResult, QuoteValidation, RouteResult, RunSpeed, ServiceWindowSummary } from "./types";

const initialInput: QuoteInput = {
  pickup: null,
  destination: null,
  size: "medium",
  speed: "normal",
  volume: volumeForSize("medium"),
  collateral: 0,
};

const initialRoute = fallbackRoute(initialInput);
const initialValidation = fallbackQuoteValidation(initialInput);
const SOLANE_UI_ACCENT = "#a855f7";
const MIN_COLLATERAL_FOR_REWARD = 10_000_000;

function parisHour(now: Date) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Europe/Paris",
      }).format(now),
    );
  } catch {
    return 18;
  }
}

function serviceWindowFallback(now = new Date()): ServiceWindowSummary {
  const hour = parisHour(now);

  if (hour >= 23 || hour < 8) {
    return {
      detail: "Night EUTZ",
      level: "low_activity",
      label: "Low Activity",
      lastSyncedAt: null,
      isFresh: false,
      source: "schedule",
    };
  }

  if (hour < 17) {
    return {
      detail: "Day EUTZ",
      level: "medium_activity",
      label: "Medium Activity",
      lastSyncedAt: null,
      isFresh: false,
      source: "schedule",
    };
  }

  return {
    detail: "Prime EUTZ",
    level: "high_activity",
    label: "High Activity",
    lastSyncedAt: null,
    isFresh: false,
    source: "schedule",
  };
}

type RoadOverviewView = {
  closing: boolean;
  input: QuoteInput;
  route: RouteResult;
};

type SizeSelectorView = {
  closing: boolean;
};

type SizePlaceholderView = {
  closing: boolean;
};

function App() {
  const isRouteIntelPage = window.location.pathname === "/route-intel";
  const [input, setInput] = useState<QuoteInput>(initialInput);
  const [collateralText, setCollateralText] = useState("");
  const [quoteValidation, setQuoteValidation] = useState<QuoteValidation>(initialValidation);
  const [quote, setQuote] = useState<QuoteResult>(() => calculateQuote(initialInput, initialRoute, initialValidation));
  const [roadOverviewView, setRoadOverviewView] = useState<RoadOverviewView | null>(null);
  const [sizeSelectorView, setSizeSelectorView] = useState<SizeSelectorView | null>(null);
  const [sizePlaceholderView, setSizePlaceholderView] = useState<SizePlaceholderView | null>({ closing: false });
  const [serviceWindow, setServiceWindow] = useState(() => serviceWindowFallback());
  const [, setIsSyncing] = useState(false);
  const inputRef = useRef(input);
  const quoteRef = useRef(quote);
  const quoteValidationRef = useRef(quoteValidation);
  const requestRef = useRef(0);
  const validationRequestRef = useRef(0);

  const pickupId = input.pickup?.id;
  const destinationId = input.destination?.id;
  const endpointsReady = Boolean(input.pickup && input.destination);
  const showRoadOverview = Boolean(input.pickup && input.destination);
  const layoutHasRoadOverview = showRoadOverview || Boolean(roadOverviewView);
  const cargoSizeOptions = availableCargoSizesForQuote(input, quoteValidation);
  const collateralValidation = validateCollateral(input, quoteValidation);
  const collateralInvalid = !collateralValidation.valid;
  const blockingRisk = quote.risk?.isBlocking
    ? quote.risk
    : quoteValidation.risk?.isBlocking
      ? quoteValidation.risk
      : null;
  const controlsBlockedByRisk = Boolean(blockingRisk);
  const riskBlockedReason = blockingRisk
    ? blockingRisk.reason ?? "Route restricted by Solane risk controls."
    : null;

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);

  useEffect(() => {
    quoteValidationRef.current = quoteValidation;
  }, [quoteValidation]);

  const syncRoute = useCallback(async () => {
    const routeInput = inputRef.current;
    if (!routeInput.pickup || !routeInput.destination) {
      return;
    }

    const pickupId = routeInput.pickup.id;
    const destinationId = routeInput.destination.id;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    setIsSyncing(true);
    try {
      const route = await fetchEsiRoute(pickupId, destinationId);
      const latestInput = inputRef.current;
      if (
        requestRef.current !== requestId ||
        latestInput.pickup?.id !== pickupId ||
        latestInput.destination?.id !== destinationId
      ) {
        return;
      }

      setQuote((currentQuote) => ({ ...currentQuote, route }));
    } catch {
      const latestInput = inputRef.current;
      const currentRoute = quoteRef.current.route.source === "esi"
        ? quoteRef.current.route
        : fallbackRoute(latestInput);
      setQuote((currentQuote) => ({ ...currentQuote, route: currentRoute }));
    } finally {
      if (requestRef.current === requestId) {
        setIsSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!pickupId || !destinationId) {
      requestRef.current += 1;
      setIsSyncing(false);
      return;
    }

    void syncRoute();
  }, [pickupId, destinationId, syncRoute]);

  useEffect(() => {
    if (endpointsReady) {
      setSizeSelectorView({ closing: false });
      setSizePlaceholderView((currentView) => {
        if (!currentView || currentView.closing) {
          return currentView;
        }
        return { closing: true };
      });

      const timeout = window.setTimeout(() => {
        setSizePlaceholderView((currentView) => (currentView?.closing ? null : currentView));
      }, 260);

      return () => window.clearTimeout(timeout);
    }

    setSizePlaceholderView({ closing: false });
    setSizeSelectorView((currentView) => {
      if (!currentView || currentView.closing) {
        return currentView;
      }
      return { closing: true };
    });

    const timeout = window.setTimeout(() => {
      setSizeSelectorView((currentView) => (currentView?.closing ? null : currentView));
    }, 320);

    return () => window.clearTimeout(timeout);
  }, [endpointsReady]);

  useEffect(() => {
    const localValidation = fallbackQuoteValidation(input);
    const requestId = validationRequestRef.current + 1;
    validationRequestRef.current = requestId;

    if (!input.pickup || !input.destination) {
      setQuoteValidation(localValidation);
      setQuote((currentQuote) => calculateQuote(input, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(input), localValidation));
      return;
    }

    const collateralEntered = collateralText.trim().length > 0;
    const pricingInput = collateralEntered
      ? input
      : {
          ...input,
          collateral: MIN_COLLATERAL_FOR_REWARD,
        };

    const quoteForDisplay = (route: RouteResult, pricing: QuotePricing): QuoteResult => {
      if (collateralEntered || pricing.blockedCode === "risk_restricted" || pricing.risk?.isBlocking) {
        return quoteFromPricing(route, pricing);
      }

      return {
        route,
        estimate: 0,
        risk: pricing.risk ?? route.routeRisk ?? null,
        blockedCode: "missing_collateral",
        currency: "ISK",
        pricingLabel: "Awaiting collateral",
        pricingMode: "blocked",
        source: "api",
      };
    };

    const applyPricing = (pricing: QuotePricing) => {
      if (validationRequestRef.current !== requestId) {
        return;
      }

      const shouldCorrectSize = !pricing.selectedSizeValid && pricing.allowedSizes.length > 0;
      const correctedSize = shouldCorrectSize ? largestAllowedCargoSize(pricing) : input.size;
      const nextInput = shouldCorrectSize
        ? {
            ...input,
            size: correctedSize,
            volume: volumeForSize(correctedSize),
          }
        : input;
      const collateralWithinLimit = nextInput.collateral <= pricing.maxCollateral;
      const nextValidation = shouldCorrectSize
        ? {
            ...pricing,
            blockedCode: collateralWithinLimit ? null : "collateral_limit" as const,
            blockedReason: collateralWithinLimit
              ? null
              : `Collateral limit exceeded. Maximum allowed is ${pricing.maxCollateral.toLocaleString("en-US")} ISK.`,
            selectedSizeValid: true,
            valid: collateralWithinLimit,
          }
        : pricing;

      if (shouldCorrectSize) {
        setInput(nextInput);
        setQuoteValidation(nextValidation);
        setQuote((currentQuote) => quoteForDisplay(
          currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput),
          nextValidation,
        ));
        return;
      }

      setQuoteValidation(nextValidation);
      setQuote((currentQuote) => quoteForDisplay(
        currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput),
        pricing,
      ));
    };

    const applyFallback = () => {
      if (validationRequestRef.current !== requestId) {
        return;
      }
      setQuoteValidation(localValidation);
      setQuote((currentQuote) => {
        const route = currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(input);
        if (!collateralEntered) {
          return {
            route,
            estimate: 0,
            risk: localValidation.risk ?? route.routeRisk ?? null,
            blockedCode: "missing_collateral",
            currency: "ISK",
            pricingLabel: "Awaiting collateral",
            pricingMode: "blocked",
            source: "local",
          };
        }

        return calculateQuote(input, route, localValidation);
      });
    };

    void fetchQuoteCalculation(pricingInput)
      .then(applyPricing)
      .catch(applyFallback);
  }, [collateralText, input]);

  useEffect(() => {
    let mounted = true;

    const refreshServiceWindow = async () => {
      try {
        const nextServiceWindow = await fetchServiceWindow();
        if (mounted) {
          setServiceWindow(nextServiceWindow);
        }
      } catch {
        if (mounted) {
          setServiceWindow(serviceWindowFallback());
        }
      }
    };

    void refreshServiceWindow();
    const interval = window.setInterval(refreshServiceWindow, 300_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (showRoadOverview) {
      setRoadOverviewView({ closing: false, input, route: quote.route });
      return;
    }

    setRoadOverviewView((currentView) => {
      if (!currentView || currentView.closing) {
        return currentView;
      }
      return { ...currentView, closing: true };
    });

    const timeout = window.setTimeout(() => {
      setRoadOverviewView((currentView) => (currentView?.closing ? null : currentView));
    }, 420);

    return () => window.clearTimeout(timeout);
  }, [input, quote.route, showRoadOverview]);

  const normalizeQuoteInput = (nextInput: QuoteInput): QuoteInput => {
    const nextValidation = fallbackQuoteValidation(nextInput);
    const nextSizeOptions = availableCargoSizesForQuote(nextInput, nextValidation);
    const currentSizeAvailable = nextSizeOptions.some((option) => option.value === nextInput.size && !option.disabled);
    if (currentSizeAvailable) {
      return {
        ...nextInput,
        volume: volumeForSize(nextInput.size),
      };
    }

    const fallbackSize = nextSizeOptions.find((option) => !option.disabled)?.value ?? cargoSizes[0].value;
    return {
      ...nextInput,
      size: fallbackSize,
      volume: volumeForSize(fallbackSize),
    };
  };

  const updateInput = <K extends keyof QuoteInput>(key: K, value: QuoteInput[K]) => {
    const nextInput = normalizeQuoteInput({ ...input, [key]: value });
    const nextValidation = fallbackQuoteValidation(nextInput);
    setInput(nextInput);
    setQuoteValidation(nextValidation);
    setQuote(calculateQuote(nextInput, fallbackRoute(nextInput), nextValidation));
  };

  const updateSize = (size: CargoSize) => {
    const nextInput = {
      ...input,
      size,
      volume: volumeForSize(size),
    };
    const nextValidation = fallbackQuoteValidation(nextInput);
    setInput(nextInput);
    setQuoteValidation(nextValidation);
    setQuote((currentQuote) => calculateQuote(nextInput, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput), nextValidation));
  };

  const updateSpeed = (speed: RunSpeed) => {
    const nextInput = {
      ...input,
      speed,
    };
    const nextValidation = fallbackQuoteValidation(nextInput);
    setInput(nextInput);
    setQuoteValidation(nextValidation);
    setQuote((currentQuote) => calculateQuote(nextInput, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput), nextValidation));
  };

  const toggleRush = () => {
    updateSpeed(input.speed === "rush" ? "normal" : "rush");
  };

  const updateCollateral = (value: string) => {
    const nextText = formatIskInputText(value);
    const parsed = parseIskInput(nextText);
    const nextInput = {
      ...input,
      collateral: parsed,
    };
    const nextValidation = fallbackQuoteValidation(nextInput);

    setCollateralText(nextText);
    setInput(nextInput);
    setQuoteValidation(nextValidation);
    setQuote((currentQuote) => calculateQuote(nextInput, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput), nextValidation));
  };

  const applyCollateralMultiplier = (multiplier: number) => {
    const baseValue = parseCollateralShortcutBase(collateralText);
    if (baseValue === null) {
      return;
    }

    updateCollateral(String(Math.round(baseValue * multiplier)));
  };

  return (
    <AppShell
      accentColor={SOLANE_UI_ACCENT}
      destinationColor={SOLANE_UI_ACCENT}
      routeVisible={layoutHasRoadOverview && !isRouteIntelPage}
      serviceLabel="Solane"
    >
        {isRouteIntelPage ? (
          <RouteIntelPage />
        ) : (
        <>
      <section
        className={`mission-console ${layoutHasRoadOverview ? "mission-console-with-route" : ""}`}
        id="calculator"
        aria-label="Solane Run freight calculator"
      >
        <DataPanel className="form-panel" title="Freight parameters">
          <div className="system-row">
            <SystemAutocomplete
              label="Pick Up"
              onChange={(system) => updateInput("pickup", system)}
              placeholder="Search a system"
              value={input.pickup}
            />
            <ArrowRight aria-hidden="true" className="system-arrow" size={22} />
            <SystemAutocomplete
              label="Destination"
              onChange={(system) => updateInput("destination", system)}
              placeholder="Search a system"
              value={input.destination}
            />
          </div>

          {riskBlockedReason ? (
            <div className="quote-input-alert quote-input-alert-restricted" role="alert">
              <strong>Restricted route</strong>
              <span>{riskBlockedReason} Change Pick Up or Destination to continue.</span>
            </div>
          ) : null}

          <div className="size-slot">
            {sizePlaceholderView ? (
              <div
                className={`size-placeholder ${sizePlaceholderView.closing ? "size-placeholder-closing" : ""}`}
              >
                <span className="size-placeholder-label">Size</span>
                <p>Set Pick Up and Destination to unlock cargo sizes.</p>
              </div>
            ) : null}

            {sizeSelectorView ? (
              <div className={`size-reveal ${sizeSelectorView.closing ? "size-reveal-closing" : ""}`}>
                <SegmentedControl<CargoSize>
                  label="Size"
                  onChange={updateSize}
                  options={cargoSizeOptions.map((size) => ({ disabled: controlsBlockedByRisk || size.disabled, label: size.label, value: size.value }))}
                  value={input.size}
                />
              </div>
            ) : null}
          </div>

          <div className="speed-toggle">
            <span className="speed-toggle-label">Speed</span>
            <button
              aria-label={`Speed ${labelForSpeed(input.speed)}`}
              aria-pressed={input.speed === "rush"}
              className="speed-toggle-button"
              disabled={controlsBlockedByRisk}
              onClick={toggleRush}
              type="button"
            >
              <span className="speed-toggle-track" aria-hidden="true">
                <span className="speed-toggle-thumb" />
                <span>Normal</span>
                <span>Rush</span>
              </span>
            </button>
          </div>

          <Input
            inputAccessory={(
              <span className="collateral-quick-actions" role="group" aria-label="Collateral shortcuts">
                <button
                  aria-label="Convert collateral to millions"
                  disabled={controlsBlockedByRisk}
                  onClick={() => applyCollateralMultiplier(1_000_000)}
                  type="button"
                >
                  M
                </button>
                <button
                  aria-label="Convert collateral to billions"
                  disabled={controlsBlockedByRisk}
                  onClick={() => applyCollateralMultiplier(1_000_000_000)}
                  type="button"
                >
                  B
                </button>
              </span>
            )}
            accessory={
              <span className="collateral-limit-chip" title={`Max collateral ${formatIskInput(collateralValidation.limit)} ISK`}>
                <span>Max collateral</span>
                <strong>{formatIskInput(collateralValidation.limit)} ISK</strong>
              </span>
            }
            aria-invalid={collateralInvalid}
            className={collateralInvalid ? "field-invalid" : ""}
            disabled={controlsBlockedByRisk}
            hint={collateralInvalid ? collateralValidation.message ?? undefined : undefined}
            inputMode="decimal"
            label="Collateral"
            maxLength={18}
            onChange={(event) => updateCollateral(event.target.value)}
            pattern="[0-9 .,]*"
            placeholder="Enter collateral"
            value={collateralText}
          />

          <p className="auto-calc-note">
            Auto-calculated as inputs change.
          </p>

          <div className="quote-input-reserve" aria-hidden="true" />
        </DataPanel>

        {roadOverviewView ? (
          <RouteOverview
            closing={roadOverviewView.closing}
            input={roadOverviewView.input}
            risk={quote.risk ?? quoteValidation.risk ?? null}
            route={roadOverviewView.route}
          />
        ) : null}

        <QuotePanel
          input={input}
          result={quote}
          serviceWindow={serviceWindow}
        />
      </section>

      <footer className="site-footer">
        <strong>Solane Run</strong>
        <span>Premium & independant freight shipping service</span>
        <span>{"\u00a9"} 2026 Victor A. All rights reserved.</span>
      </footer>
        </>
      )}
    </AppShell>
  );
}

export default App;

function parseCollateralShortcutBase(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(/,/g, ".");
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^\d+(?:\.\d+)?$/);
  if (!match) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
