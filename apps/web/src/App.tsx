import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { AppShell } from "./components/AppShell";
import { DataPanel } from "./components/DataPanel";
import { QuotePanel } from "./components/QuotePanel";
import { SystemAutocomplete } from "./components/SystemAutocomplete";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { SegmentedControl } from "./components/ui/SegmentedControl";
import {
  calculateQuote,
  cargoSizes,
  DEFAULT_COLLATERAL_VALUE,
  fallbackRoute,
  labelForSpeed,
  MAX_COLLATERAL_VALUE,
  volumeForSize,
} from "./data/quote";
import { fetchEsiRoute } from "./lib/api";
import { formatIskInput, parseIskInput } from "./lib/format";
import type { CargoSize, QuoteInput, QuoteResult, RunSpeed } from "./types";

const initialInput: QuoteInput = {
  pickup: null,
  destination: null,
  size: "medium",
  speed: "rush",
  volume: volumeForSize("medium"),
  collateral: DEFAULT_COLLATERAL_VALUE,
};

const initialRoute = fallbackRoute(initialInput);

function App() {
  const [input, setInput] = useState<QuoteInput>(initialInput);
  const [collateralText, setCollateralText] = useState(formatIskInput(initialInput.collateral));
  const [quote, setQuote] = useState<QuoteResult>(() => calculateQuote(initialInput, initialRoute));
  const [isSyncing, setIsSyncing] = useState(false);
  const inputRef = useRef(input);
  const quoteRef = useRef(quote);
  const requestRef = useRef(0);

  const activeColor = input.pickup?.color ?? "#19a8ff";
  const destinationColor = input.destination?.color ?? activeColor;
  const activeService = input.pickup?.serviceType ?? "Solane";
  const pickupId = input.pickup?.id;
  const destinationId = input.destination?.id;
  const canCalculate = Boolean(input.pickup && input.destination) && !isSyncing;

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

  const updateInput = <K extends keyof QuoteInput>(key: K, value: QuoteInput[K]) => {
    const nextInput = { ...input, [key]: value };
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

  const calculateRun = () => {
    void syncRoute();
  };

  const updateCollateral = (value: string) => {
    const parsed = parseIskInput(value);
    const cappedCollateral = Math.min(parsed, MAX_COLLATERAL_VALUE);
    const nextText = parsed > MAX_COLLATERAL_VALUE ? formatIskInput(MAX_COLLATERAL_VALUE) : value;
    const nextInput = {
      ...input,
      collateral: cappedCollateral,
    };

    setCollateralText(nextText);
    setInput(nextInput);
    setQuote((currentQuote) => calculateQuote(nextInput, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput)));
  };

  return (
    <AppShell accentColor={activeColor} destinationColor={destinationColor} serviceLabel={activeService}>
      <section className="mission-console" id="calculator" aria-label="Solane Run freight calculator">
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
            options={cargoSizes.map((size) => ({ label: size.label, value: size.value }))}
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
            inputMode="decimal"
            label="Collateral"
            maxLength={18}
            onChange={(event) => updateCollateral(event.target.value)}
            placeholder="Up to 5B ISK"
            value={collateralText}
          />

          <Button
            className="calculate-run-button"
            disabled={!canCalculate}
            onClick={calculateRun}
            variant="secondary"
          >
            {isSyncing ? "Syncing route" : "Calculate Run"}
          </Button>

          <div className="quote-input-reserve" aria-hidden="true" />
        </DataPanel>

        <QuotePanel
          input={input}
          result={quote}
        />
      </section>

      <footer className="site-footer">
        <strong>Solane Run</strong>
        <span>Premium freight desk for New Eden</span>
        <span>Beta operations - 2026</span>
      </footer>
    </AppShell>
  );
}

export default App;
