import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Clock3,
  DatabaseZap,
  ExternalLink,
  PlaneTakeoff,
  ShieldCheck,
} from "lucide-react";

import { AppShell } from "./components/AppShell";
import { DataPanel } from "./components/DataPanel";
import { QuotePanel } from "./components/QuotePanel";
import { SystemAutocomplete } from "./components/SystemAutocomplete";
import { Button } from "./components/ui/Button";
import { SegmentedControl } from "./components/ui/SegmentedControl";
import { COLLATERAL_VALUE, calculateQuote, cargoSizes, fallbackRoute, labelForSize, volumeForSize } from "./data/quote";
import { fetchEsiRoute } from "./lib/api";
import type { CargoSize, QuoteInput, QuoteResult, RouteSystem, SolarSystem } from "./types";

const initialInput: QuoteInput = {
  pickup: null,
  destination: null,
  size: "medium",
  volume: volumeForSize("medium"),
  collateral: COLLATERAL_VALUE,
};

const initialRoute = fallbackRoute(initialInput);

const starField = [
  [18, 96, 0.7], [47, 308, 1.1], [73, 58, 0.6], [96, 246, 0.8], [128, 151, 0.5],
  [152, 338, 0.7], [181, 84, 1.2], [213, 276, 0.5], [235, 37, 0.6], [267, 176, 0.8],
  [294, 354, 0.6], [322, 102, 1.0], [348, 254, 0.5], [371, 64, 0.7], [397, 316, 0.9],
  [421, 142, 0.5], [446, 228, 1.3], [475, 42, 0.6], [506, 292, 0.7], [531, 88, 0.5],
  [566, 372, 1.1], [589, 196, 0.6], [613, 121, 0.8], [642, 334, 0.5], [671, 52, 0.9],
  [704, 242, 0.6], [729, 392, 0.7], [758, 137, 1.0], [786, 286, 0.5], [815, 78, 0.8],
  [846, 366, 0.6], [874, 208, 1.2], [33, 372, 0.5], [112, 18, 0.7], [203, 408, 0.8],
  [287, 215, 0.6], [438, 386, 0.5], [493, 164, 0.7], [548, 28, 0.8], [697, 314, 0.5],
  [832, 32, 0.7], [858, 122, 0.5], [66, 188, 0.6], [169, 238, 0.5], [257, 123, 0.9],
  [333, 389, 0.5], [386, 181, 0.6], [462, 333, 0.7], [619, 266, 0.5], [738, 49, 0.6],
  [812, 251, 0.8], [884, 404, 0.5], [24, 24, 1.0], [142, 401, 0.6], [226, 311, 0.7],
  [319, 18, 0.5], [512, 414, 0.8], [575, 231, 0.5], [654, 174, 0.7], [766, 407, 0.6],
] as const;

function App() {
  const [input, setInput] = useState<QuoteInput>(initialInput);
  const [quote, setQuote] = useState<QuoteResult>(() => calculateQuote(initialInput, initialRoute));
  const [message, setMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const inputRef = useRef(input);
  const quoteRef = useRef(quote);
  const requestRef = useRef(0);

  const activeColor = input.pickup?.color ?? "#19a8ff";
  const destinationColor = input.destination?.color ?? activeColor;
  const activeService = input.pickup?.serviceType ?? "Solane";
  const pickupId = input.pickup?.id;
  const destinationId = input.destination?.id;
  const routeNodes = useMemo(() => buildRouteNodes(quote.route.routeSystems, input), [input, quote.route.routeSystems]);
  const routePoints = useMemo(() => layoutRoutePoints(routeNodes.length), [routeNodes.length]);
  const splitIndex = Math.max(0, Math.floor((routePoints.length - 1) / 2));
  const routeServices = routeServiceLabels(input.pickup, input.destination);
  const canCalculate = Boolean(input.pickup && input.destination) && !isSyncing;

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);

  const syncRoute = useCallback(async (mode: "auto" | "manual") => {
    const routeInput = inputRef.current;
    if (!routeInput.pickup || !routeInput.destination) {
      return;
    }

    const pickupId = routeInput.pickup.id;
    const destinationId = routeInput.destination.id;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    setIsSyncing(true);
    setMessage(mode === "manual" ? "Manual route sync in progress." : "Calculating route automatically.");

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
      setMessage(
        mode === "manual"
          ? "Route refreshed manually."
          : "Route calculated automatically. Calculate Run can retry if the ESI sync ever stalls.",
      );
    } catch {
      const latestInput = inputRef.current;
      const currentRoute = quoteRef.current.route.source === "esi"
        ? quoteRef.current.route
        : fallbackRoute(latestInput);
      setQuote(calculateQuote(latestInput, currentRoute));
      setMessage("Automatic route sync paused. Check the route endpoints or retry Calculate Run.");
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

    void syncRoute("auto");
  }, [pickupId, destinationId, syncRoute]);

  const updateInput = <K extends keyof QuoteInput>(key: K, value: QuoteInput[K]) => {
    const nextInput = { ...input, [key]: value };
    setInput(nextInput);
    setQuote(calculateQuote(nextInput, fallbackRoute(nextInput)));
    setMessage(nextInput.pickup && nextInput.destination
      ? "Route endpoints locked. Automatic calculation is starting."
      : "");
  };

  const updateSize = (size: CargoSize) => {
    const nextInput = {
      ...input,
      size,
      volume: volumeForSize(size),
      collateral: COLLATERAL_VALUE,
    };
    setInput(nextInput);
    setQuote((currentQuote) => calculateQuote(nextInput, currentQuote.route.source === "esi" ? currentQuote.route : fallbackRoute(nextInput)));
    setMessage(nextInput.pickup && nextInput.destination
      ? "Cargo size updated. Quote refreshed automatically."
      : "");
  };

  const calculateRun = () => {
    void syncRoute("manual");
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

          <div className="collateral-readout">
            <span>Collateral</span>
            <strong>5.00B ISK</strong>
          </div>

          <div className="service-color-card">
            <span>Pickup Service</span>
            <strong>{input.pickup ? input.pickup.serviceType : "Awaiting Pick Up"}</strong>
            <i style={{ background: activeColor }} />
          </div>

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

        <section className="route-panel route-map-panel" id="route" aria-labelledby="route-overview-title">
          <div className="route-map-header">
            <h2 id="route-overview-title">Route Overview</h2>
          </div>
          <div className="route-visual">
            <div className="route-service-chip" aria-label="Active pickup service">
              {routeServices.map((service) => (
                <span key={service.label}>
                  <i style={{ background: service.color }} />
                  {service.label}
                </span>
              ))}
            </div>
            <svg
              aria-label="Route overview map"
              className="route-map"
              role="img"
              viewBox="0 0 900 430"
            >
              <defs>
                <filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <g className="map-stars">
                {starField.map(([x, y, r], index) => (
                  <circle cx={x} cy={y} key={index} r={r} />
                ))}
              </g>

              <polyline className="route-arc route-arc-shadow" points={pointsToString(routePoints.slice(0, splitIndex + 1))} />
              <polyline className="route-arc route-arc-shadow destination-segment" points={pointsToString(routePoints.slice(splitIndex))} />
              <polyline className="route-arc pickup-segment" points={pointsToString(routePoints.slice(0, splitIndex + 1))} />
              <polyline className="route-arc destination-segment" points={pointsToString(routePoints.slice(splitIndex))} />

              {routeNodes.map((node, index) => {
                const point = routePoints[index];
                return (
                  <RouteNode
                    color={index <= splitIndex ? activeColor : destinationColor}
                    destination={index === routeNodes.length - 1}
                    key={`${node.id}-${index}`}
                    label={node.name}
                    major={index === 0 || index === routeNodes.length - 1}
                    security={node.securityDisplay ?? undefined}
                    x={point.x}
                    y={point.y}
                  />
                );
              })}
            </svg>
            <button className="view-map-button" type="button">
              View on Map
              <ExternalLink size={17} />
            </button>
          </div>

          <div className="telemetry-grid">
            <div>
              <DatabaseZap size={18} />
              <span>Route Source</span>
              <strong>{quote.route.source === "esi" ? "Public ESI" : "Awaiting Sync"}</strong>
            </div>
            <div>
              <PlaneTakeoff size={18} />
              <span>Jumps</span>
              <strong>{quote.route.jumps}</strong>
            </div>
            <div>
              <Boxes size={18} />
              <span>Size</span>
              <strong>{labelForSize(input.size)}</strong>
            </div>
          </div>
        </section>

        <QuotePanel
          input={input}
          message={message}
          result={quote}
        />
      </section>

      <section className="detail-band">
        <div>
          <PlaneTakeoff size={22} />
          <span>Jumps</span>
          <strong>{quote.route.jumps}</strong>
        </div>
        <div>
          <ShieldCheck size={22} />
          <span>Service</span>
          <strong>{routeServices.map((service) => service.label).join(" / ")}</strong>
        </div>
        <div>
          <Boxes size={22} />
          <span>Size</span>
          <strong>{labelForSize(input.size)}</strong>
        </div>
        <div>
          <Clock3 size={22} />
          <span>Transit Estimate</span>
          <strong>{quote.route.jumps > 0 ? `${Math.max(2, Math.round(quote.route.jumps * 0.8))}h window` : "Pending route"}</strong>
        </div>
      </section>
    </AppShell>
  );
}

function RouteNode({
  color,
  destination = false,
  label,
  major = false,
  security,
  x,
  y,
}: {
  color: string;
  destination?: boolean;
  label: string;
  major?: boolean;
  security?: string;
  x: number;
  y: number;
}) {
  return (
    <g
      className={`route-node ${major ? "route-node-major" : ""} ${destination ? "destination" : ""}`}
      style={{ "--node-accent": color } as CSSProperties}
      transform={`translate(${x} ${y})`}
    >
      <circle r={major ? 14 : 9} />
      <circle r={major ? 6.5 : 4} />
      <text className={`route-label ${major ? "route-label-major" : ""}`} x={major ? (destination ? -78 : -34) : -22} y={major ? -34 : 30}>
        {label}
      </text>
      {security ? (
        <text className="route-sec" x={major ? (destination ? 20 : 36) : -10} y={major ? -34 : 46}>
          {security}
        </text>
      ) : null}
    </g>
  );
}

function buildRouteNodes(routeSystems: RouteSystem[], input: QuoteInput) {
  const endpoints = [input.pickup, input.destination].filter((system): system is SolarSystem => Boolean(system));
  const source = routeSystems.length >= 2 ? routeSystems : endpoints;
  if (source.length === 0) {
    return [
      { id: 0, name: "Pick Up", securityDisplay: null },
      { id: 1, name: "Destination", securityDisplay: null },
    ];
  }

  const targetCount = Math.min(10, Math.max(2, source.length));
  const selected: RouteSystem[] = [];
  for (let index = 0; index < targetCount; index += 1) {
    const sourceIndex = Math.round((index * (source.length - 1)) / (targetCount - 1));
    selected.push(source[sourceIndex]);
  }

  return selected.filter((system, index, systems) => index === 0 || system.id !== systems[index - 1].id);
}

function layoutRoutePoints(count: number) {
  const total = Math.max(2, count);
  return Array.from({ length: total }, (_, index) => {
    const progress = total === 1 ? 0 : index / (total - 1);
    return {
      x: 72 + progress * 760,
      y: 205 + Math.sin(progress * Math.PI * 1.45 - 0.35) * 52 + Math.sin(progress * Math.PI * 3.1) * 18,
    };
  });
}

function pointsToString(points: { x: number; y: number }[]) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function routeServiceLabels(pickup: SolarSystem | null, destination: SolarSystem | null) {
  const pickupService = pickup?.serviceType ?? "No Pick Up";
  const destinationService = destination?.serviceType ?? pickupService;
  const pickupColor = pickup?.color ?? "#19a8ff";
  const destinationColor = destination?.color ?? pickupColor;

  if (pickupService === destinationService) {
    return [{ label: pickupService, color: pickupColor }];
  }

  return [
    { label: pickupService, color: pickupColor },
    { label: destinationService, color: destinationColor },
  ];
}

export default App;
