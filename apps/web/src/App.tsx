import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";

import { AppShell } from "./components/AppShell";
import { DataPanel } from "./components/DataPanel";
import { QuotePanel } from "./components/QuotePanel";
import { SystemAutocomplete } from "./components/SystemAutocomplete";
import { Input } from "./components/ui/Input";
import { SegmentedControl } from "./components/ui/SegmentedControl";
import {
  availableCargoSizesForQuote,
  calculateQuote,
  cargoSizes,
  fallbackQuoteValidation,
  fallbackRoute,
  labelForSpeed,
  largestAllowedCargoSize,
  quoteFromPricing,
  validateCollateral,
  volumeForSize,
} from "./data/quote";
import { fetchEsiRoute, fetchQuoteCalculation, fetchServiceWindow } from "./lib/api";
import { formatIskInput, formatIskInputText, parseIskInput } from "./lib/format";
import type { CargoSize, QuoteInput, QuotePricing, QuoteResult, QuoteValidation, RouteResult, RunSpeed, ServiceWindowSummary } from "./types";

const MIN_COLLATERAL_FOR_REWARD = 10_000_000;

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

function App() {
  const [input, setInput] = useState<QuoteInput>(initialInput);
  const [collateralText, setCollateralText] = useState("");
  const [quoteValidation, setQuoteValidation] = useState<QuoteValidation>(initialValidation);
  const [quote, setQuote] = useState<QuoteResult>(() => calculateQuote(initialInput, initialRoute, initialValidation));
  const [serviceWindow, setServiceWindow] = useState<ServiceWindowSummary>(() => serviceWindowFallback());
  const [esiRecoveryKey, setEsiRecoveryKey] = useState(0);
  const inputRef = useRef(input);
  const quoteRef = useRef(quote);
  const requestRef = useRef(0);
  const pricingRequestRef = useRef(0);

  const endpointsReady = Boolean(input.pickup && input.destination);
  const pickupId = input.pickup?.id;
  const destinationId = input.destination?.id;
  const collateralEntered = collateralText.trim().length > 0 && input.collateral > 0;
  const quoteReady = endpointsReady && collateralEntered;
  const quoteSyncing = quoteReady && quote.source === "local" && quote.blockedCode === "pricing_unavailable";
  const cargoSizeOptions = availableCargoSizesForQuote(input, quoteValidation);
  const coreCargoSizeOptions = cargoSizeOptions.filter((size) => size.value !== "freighter");
  const freighterCargoSizeOption = cargoSizeOptions.find((size) => size.value === "freighter");
  const collateralValidation = validateCollateral(input, quoteValidation);
  const collateralInvalid = !collateralValidation.valid;
  const blockingRisk = quote.risk?.isBlocking
    ? quote.risk
    : quoteValidation.risk?.isBlocking
      ? quoteValidation.risk
      : null;
  const controlsBlockedByRisk = Boolean(blockingRisk);
  const freighterSelected = input.size === "freighter";

  useEffect(() => {
    if (window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/");
    }
  }, []);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);

  useEffect(() => {
    const handleEsiRestored = () => setEsiRecoveryKey((currentKey) => currentKey + 1);
    window.addEventListener("solane:esi-restored", handleEsiRestored);
    return () => window.removeEventListener("solane:esi-restored", handleEsiRestored);
  }, []);

  const syncRoute = useCallback(async () => {
    const routeInput = inputRef.current;
    if (!routeInput.pickup || !routeInput.destination) {
      return;
    }

    const pickupId = routeInput.pickup.id;
    const destinationId = routeInput.destination.id;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

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
    }
  }, []);

  useEffect(() => {
    if (!pickupId || !destinationId) {
      requestRef.current += 1;
      return;
    }
    void syncRoute();
  }, [pickupId, destinationId, syncRoute, esiRecoveryKey]);

  useEffect(() => {
    const localValidation = fallbackQuoteValidation(input);
    const requestId = pricingRequestRef.current + 1;
    pricingRequestRef.current = requestId;

    if (!input.pickup || !input.destination) {
      setQuoteValidation(localValidation);
      setQuote((currentQuote) => calculateQuote(input, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(input), localValidation));
      return;
    }

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

    fetchQuoteCalculation(pricingInput)
      .then((pricing) => {
        if (pricingRequestRef.current !== requestId) {
          return;
        }
        const shouldCorrectSize = !pricing.selectedSizeValid && pricing.allowedSizes.length > 0;
        const correctedSize = shouldCorrectSize ? largestAllowedCargoSize(pricing) : input.size;
        const nextInput = shouldCorrectSize
          ? {
              ...input,
              size: correctedSize,
              speed: correctedSize === "freighter" ? "normal" : input.speed,
              volume: volumeForSize(correctedSize),
            }
          : input;
        const nextValidation = pricing;

        if (shouldCorrectSize) {
          setInput(nextInput);
        }
        setQuoteValidation(nextValidation);
        setQuote((currentQuote) => quoteForDisplay(
          currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput),
          nextValidation,
        ));
      })
      .catch(() => {
        if (pricingRequestRef.current !== requestId) {
          return;
        }
        setQuoteValidation(localValidation);
        setQuote((currentQuote) => calculateQuote(
          input,
          currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(input),
          localValidation,
        ));
      });
  }, [collateralEntered, collateralText, input, esiRecoveryKey]);

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
  }, [esiRecoveryKey]);

  const normalizeQuoteInput = (nextInput: QuoteInput): QuoteInput => {
    const normalizedInput = nextInput.size === "freighter"
      ? { ...nextInput, speed: "normal" as RunSpeed }
      : nextInput;
    const nextValidation = fallbackQuoteValidation(normalizedInput);
    const nextSizeOptions = availableCargoSizesForQuote(normalizedInput, nextValidation);
    const currentSizeAvailable = nextSizeOptions.some((option) => option.value === normalizedInput.size && !option.disabled);
    if (currentSizeAvailable) {
      return {
        ...normalizedInput,
        volume: volumeForSize(normalizedInput.size),
      };
    }

    const fallbackSize = nextSizeOptions.find((option) => !option.disabled)?.value ?? cargoSizes[0].value;
    return {
      ...normalizedInput,
      size: fallbackSize,
      speed: fallbackSize === "freighter" ? "normal" : normalizedInput.speed,
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
    const nextInput = normalizeQuoteInput({
      ...input,
      size,
      speed: size === "freighter" ? "normal" : input.speed,
      volume: volumeForSize(size),
    });
    const nextValidation = fallbackQuoteValidation(nextInput);
    setInput(nextInput);
    setQuoteValidation(nextValidation);
    setQuote((currentQuote) => calculateQuote(nextInput, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput), nextValidation));
  };

  const updateSpeed = (speed: RunSpeed) => {
    if (freighterSelected && speed === "rush") {
      return;
    }
    const nextInput = { ...input, speed };
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
    const nextInput = {
      ...input,
      collateral: parseIskInput(nextText),
    };
    const nextValidation = fallbackQuoteValidation(nextInput);
    setCollateralText(nextText);
    setInput(nextInput);
    setQuoteValidation(nextValidation);
    setQuote((currentQuote) => calculateQuote(nextInput, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput), nextValidation));
  };

  const applyCollateralMultiplier = (multiplier: number) => {
    const parsed = parseCollateralShortcutBase(collateralText);
    if (parsed !== null) {
      updateCollateral(String(Math.round(parsed * multiplier)));
    }
  };

  return (
    <AppShell>
      <section className="calculator-page" aria-label="Solane Run freight calculator">
        <div className="calculator-intro">
          <span>DST / BR desk</span>
          <h1>Freight calculator</h1>
          <p>Fast courier quotes with Solane Engine guardrails.</p>
        </div>

        <div className="calculator-grid">
          <DataPanel className="form-panel" eyebrow="Step 01" title="Quote parameters">
            <div className="system-row">
              <SystemAutocomplete
                label="Pick Up"
                onChange={(system) => updateInput("pickup", system)}
                placeholder="Search system"
                value={input.pickup}
              />
              <ArrowRight aria-hidden="true" className="system-arrow" size={22} />
              <SystemAutocomplete
                label="Destination"
                onChange={(system) => updateInput("destination", system)}
                placeholder="Search system"
                value={input.destination}
              />
            </div>

            {blockingRisk ? (
              <div className="quote-input-alert" role="alert">
                <AlertTriangle size={18} />
                <span>
                  <strong>Critical endpoint</strong>
                  <small>{blockingRisk.reason ?? "Selected endpoint is too dangerous for calculator service. Change Pick Up or Destination to continue."}</small>
                </span>
              </div>
            ) : null}

            <div className={controlsBlockedByRisk ? "freight-controls freight-controls-disabled" : "freight-controls"}>
              <div className="cargo-selection">
                <SegmentedControl<CargoSize>
                  label="DST / BR freight"
                  onChange={updateSize}
                  options={coreCargoSizeOptions.map((size) => ({
                    disabled: !endpointsReady || controlsBlockedByRisk || size.disabled,
                    label: size.label,
                    value: size.value,
                  }))}
                  value={!endpointsReady || freighterSelected ? null : input.size}
                />

                {freighterCargoSizeOption ? (
                  <fieldset className="freighter-choice">
                    <legend>Freighter option</legend>
                    <button
                      aria-pressed={endpointsReady && freighterSelected}
                      className="freighter-choice-button"
                      disabled={!endpointsReady || controlsBlockedByRisk || freighterCargoSizeOption.disabled}
                      onClick={() => updateSize("freighter")}
                      type="button"
                    >
                      <span>
                        <strong>{freighterCargoSizeOption.label}</strong>
                        <small>Occasional capacity</small>
                      </span>
                      <em>Normal only</em>
                    </button>
                    <p>Secondary service. Normal speed only.</p>
                  </fieldset>
                ) : null}
              </div>

              <div className="speed-toggle">
                <span className="speed-toggle-label">Speed</span>
                <button
                  aria-label={`Speed ${labelForSpeed(input.speed)}`}
                  aria-pressed={input.speed === "rush"}
                  className="speed-toggle-button"
                  disabled={controlsBlockedByRisk || freighterSelected}
                  onClick={toggleRush}
                  type="button"
                >
                  <span className="speed-toggle-track" aria-hidden="true">
                    <span className="speed-toggle-thumb" />
                    <span>Normal</span>
                    <span>Rush</span>
                  </span>
                </button>
                {freighterSelected ? <small className="control-note">800k runs Normal only.</small> : null}
              </div>

              <Input
                inputAccessory={(
                  <span className="collateral-quick-actions" role="group" aria-label="Collateral shortcuts">
                    <button disabled={controlsBlockedByRisk} onClick={() => applyCollateralMultiplier(1_000_000)} type="button">M</button>
                    <button disabled={controlsBlockedByRisk} onClick={() => applyCollateralMultiplier(1_000_000_000)} type="button">B</button>
                  </span>
                )}
                accessory={
                  <span className="collateral-limit-chip" title={`Max collateral ${formatIskInput(collateralValidation.limit)} ISK`}>
                    <span>Max</span>
                    <strong>{formatIskInput(collateralValidation.limit)} ISK</strong>
                  </span>
                }
                aria-invalid={collateralInvalid}
                className={collateralInvalid ? "field-invalid" : ""}
                disabled={controlsBlockedByRisk}
                hint={collateralInvalid ? collateralValidation.message ?? undefined : "M/B quick fill."}
                inputMode="decimal"
                label="Collateral"
                maxLength={18}
                onChange={(event) => updateCollateral(event.target.value)}
                pattern="[0-9 .,]*"
                placeholder="Enter collateral"
                value={collateralText}
              />
            </div>
          </DataPanel>

          {quoteReady && !quoteSyncing ? (
            <QuotePanel input={input} result={quote} serviceWindow={serviceWindow} />
          ) : (
            <aside
              className={`quote-placeholder ${quoteSyncing ? "quote-placeholder-syncing" : ""}`}
              aria-label={quoteSyncing ? "Quote syncing" : "Freight parameters incomplete"}
            >
              <ShieldCheck size={26} />
              <span>{quoteSyncing ? "Syncing quote" : "Awaiting quote"}</span>
              <p>{quoteSyncing ? "Checking route and reward." : "Complete route, size and collateral."}</p>
            </aside>
          )}
        </div>
      </section>
    </AppShell>
  );
}

export default App;

function serviceWindowFallback(now = new Date()): ServiceWindowSummary {
  const parisHour = Number(new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Europe/Paris",
  }).format(now));

  if (parisHour >= 23 || parisHour < 8) {
    return { detail: "Night EUTZ", isFresh: false, label: "Low Activity", lastSyncedAt: null, level: "low_activity", source: "schedule" };
  }
  if (parisHour < 17) {
    return { detail: "Day EUTZ", isFresh: false, label: "Medium Activity", lastSyncedAt: null, level: "medium_activity", source: "schedule" };
  }
  return { detail: "Prime EUTZ", isFresh: false, label: "High Activity", lastSyncedAt: null, level: "high_activity", source: "schedule" };
}

function parseCollateralShortcutBase(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(/,/g, ".");
  if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
