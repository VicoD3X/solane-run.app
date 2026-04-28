import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { AppShell } from "./components/AppShell";
import { DataPanel } from "./components/DataPanel";
import { QuotePanel } from "./components/QuotePanel";
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
import { fetchContractAcceptance, fetchEsiRoute, fetchQuoteCalculation } from "./lib/api";
import { formatIskInput, formatIskInputText, parseIskInput } from "./lib/format";
import type { CargoSize, ContractAcceptanceSummary, QuoteInput, QuotePricing, QuoteResult, QuoteValidation, RouteResult, RunSpeed } from "./types";

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
const syncingContractAcceptance: ContractAcceptanceSummary = {
  level: "syncing",
  label: "Syncing",
  lastSyncedAt: null,
  isFresh: false,
  source: "syncing",
};

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
  const [input, setInput] = useState<QuoteInput>(initialInput);
  const [collateralText, setCollateralText] = useState("");
  const [quoteValidation, setQuoteValidation] = useState<QuoteValidation>(initialValidation);
  const [quote, setQuote] = useState<QuoteResult>(() => calculateQuote(initialInput, initialRoute, initialValidation));
  const [roadOverviewView, setRoadOverviewView] = useState<RoadOverviewView | null>(null);
  const [sizeSelectorView, setSizeSelectorView] = useState<SizeSelectorView | null>(null);
  const [sizePlaceholderView, setSizePlaceholderView] = useState<SizePlaceholderView | null>({ closing: false });
  const [contractAcceptance, setContractAcceptance] = useState(syncingContractAcceptance);
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
        setQuote((currentQuote) => calculateQuote(
          nextInput,
          currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput),
          nextValidation,
        ));
        return;
      }

      setQuoteValidation(nextValidation);
      setQuote((currentQuote) => quoteFromPricing(
        currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput),
        pricing,
      ));
    };

    const applyFallback = () => {
      if (validationRequestRef.current !== requestId) {
        return;
      }
      setQuoteValidation(localValidation);
      setQuote((currentQuote) => calculateQuote(
        input,
        currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(input),
        localValidation,
      ));
    };

    void fetchQuoteCalculation(input)
      .then(applyPricing)
      .catch(applyFallback);
  }, [input]);

  useEffect(() => {
    let mounted = true;

    const refreshContractAcceptance = async () => {
      try {
        const nextAcceptance = await fetchContractAcceptance();
        if (mounted) {
          setContractAcceptance(nextAcceptance);
        }
      } catch {
        if (mounted) {
          setContractAcceptance(syncingContractAcceptance);
        }
      }
    };

    void refreshContractAcceptance();
    const interval = window.setInterval(refreshContractAcceptance, 300_000);

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

  return (
    <AppShell
      accentColor={SOLANE_UI_ACCENT}
      destinationColor={SOLANE_UI_ACCENT}
      routeVisible={layoutHasRoadOverview}
      serviceLabel="Solane"
    >
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
                  options={cargoSizeOptions.map((size) => ({ disabled: size.disabled, label: size.label, value: size.value }))}
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
            accessory={
              <span className="collateral-limit-chip" title={`Max collateral ${formatIskInput(collateralValidation.limit)} ISK`}>
                <span>Max collateral</span>
                <strong>{formatIskInput(collateralValidation.limit)} ISK</strong>
              </span>
            }
            aria-invalid={collateralInvalid}
            className={collateralInvalid ? "field-invalid" : ""}
            hint={collateralInvalid ? collateralValidation.message ?? undefined : undefined}
            inputMode="numeric"
            label="Collateral"
            maxLength={18}
            onChange={(event) => updateCollateral(event.target.value)}
            pattern="[0-9 ]*"
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
            acceptance={contractAcceptance}
            closing={roadOverviewView.closing}
            input={roadOverviewView.input}
            route={roadOverviewView.route}
          />
        ) : null}

        <QuotePanel
          input={input}
          result={quote}
        />
      </section>

      <footer className="site-footer">
        <strong>Solane Run</strong>
        <span>Premium freight desk for New Eden</span>
        <span>{"\u00a9"} 2026 Victor A. All rights reserved.</span>
      </footer>
    </AppShell>
  );
}

export default App;
