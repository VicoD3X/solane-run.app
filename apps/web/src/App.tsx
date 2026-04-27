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
  labelForSpeed,
  validateCollateral,
  volumeForSize,
} from "./data/quote";
import { fetchContractAcceptance, fetchEsiRoute } from "./lib/api";
import { formatIskInput, formatIskInputText, parseIskInput } from "./lib/format";
import type { CargoSize, ContractAcceptanceSummary, QuoteInput, QuoteResult, RouteResult, RunSpeed } from "./types";

const initialInput: QuoteInput = {
  pickup: null,
  destination: null,
  size: "medium",
  speed: "rush",
  volume: volumeForSize("medium"),
  collateral: 0,
};

const initialRoute = fallbackRoute(initialInput);
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

function App() {
  const [input, setInput] = useState<QuoteInput>(initialInput);
  const [collateralText, setCollateralText] = useState("");
  const [quote, setQuote] = useState<QuoteResult>(() => calculateQuote(initialInput, initialRoute));
  const [roadOverviewView, setRoadOverviewView] = useState<RoadOverviewView | null>(null);
  const [contractAcceptance, setContractAcceptance] = useState(syncingContractAcceptance);
  const [, setIsSyncing] = useState(false);
  const inputRef = useRef(input);
  const quoteRef = useRef(quote);
  const requestRef = useRef(0);

  const pickupId = input.pickup?.id;
  const destinationId = input.destination?.id;
  const showRoadOverview = Boolean(input.pickup && input.destination);
  const layoutHasRoadOverview = showRoadOverview || Boolean(roadOverviewView);
  const cargoSizeOptions = availableCargoSizesForQuote(input);
  const collateralValidation = validateCollateral(input);
  const collateralInvalid = !collateralValidation.valid;

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);

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

      setQuote(calculateQuote(latestInput, route));
    } catch {
      const latestInput = inputRef.current;
      const currentRoute = quoteRef.current.route.source === "esi"
        ? quoteRef.current.route
        : fallbackRoute(latestInput);
      setQuote(calculateQuote(latestInput, currentRoute));
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
    const nextSizeOptions = availableCargoSizesForQuote(nextInput);
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
    setInput(nextInput);
    setQuote(calculateQuote(nextInput, fallbackRoute(nextInput)));
  };

  const updateSize = (size: CargoSize) => {
    const nextInput = {
      ...input,
      size,
      volume: volumeForSize(size),
    };
    setInput(nextInput);
    setQuote((currentQuote) => calculateQuote(nextInput, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput)));
  };

  const updateSpeed = (speed: RunSpeed) => {
    const nextInput = {
      ...input,
      speed,
    };
    setInput(nextInput);
    setQuote((currentQuote) => calculateQuote(nextInput, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput)));
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

    setCollateralText(nextText);
    setInput(nextInput);
    setQuote((currentQuote) => calculateQuote(nextInput, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput)));
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
        <DataPanel className="form-panel" eyebrow="Quote Input" title="Freight parameters">
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

          <SegmentedControl<CargoSize>
            label="Size"
            onChange={updateSize}
            options={cargoSizeOptions.map((size) => ({ disabled: size.disabled, label: size.label, value: size.value }))}
            value={input.size}
          />

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
