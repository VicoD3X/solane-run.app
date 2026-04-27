import type { CSSProperties } from "react";
import { Activity, Shield } from "lucide-react";

import type { QuoteInput, RouteResult, RouteSystem, SolarSystem } from "../types";

type RouteOverviewProps = {
  closing?: boolean;
  input: QuoteInput;
  route: RouteResult;
};

const fallbackColor = "#8393a3";

export function RouteOverview({ closing = false, input, route }: RouteOverviewProps) {
  const systems = route.routeSystems.length > 0 ? route.routeSystems : fallbackSystems(input);
  const routeLabel = input.pickup && input.destination
    ? `${input.pickup.name} - ${input.destination.name}`
    : "Awaiting endpoints";

  return (
    <section
      className={`road-overview ${closing ? "road-overview-closing" : ""}`}
      id="route"
      aria-labelledby="road-overview-title"
    >
      <div className="road-overview-scan" aria-hidden="true" />
      <header className="road-overview-header">
        <div>
          <span>Road Overview</span>
          <h2 id="road-overview-title">{routeLabel}</h2>
        </div>
        <strong>
          <Activity size={15} />
          Total jumps: {route.jumps}
        </strong>
      </header>

      <div className="road-overview-strip" aria-label="Route security timeline">
        {systems.map((system, index) => (
          <RouteCell
            key={`${system.id}-${index}`}
            index={index}
            system={system}
          />
        ))}
      </div>

      <footer className="road-overview-footer">
        <span>
          <Shield size={14} />
          Security bands
        </span>
        <ul aria-label="Route service color legend">
          {legendItems(systems).map((item) => (
            <li key={item.label}>
              <i style={{ background: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      </footer>
    </section>
  );
}

function RouteCell({ index, system }: { index: number; system: RouteSystem }) {
  const color = system.color ?? fallbackColor;
  const service = system.serviceType ?? "Unknown";
  const security = system.securityDisplay ?? "unknown";
  const traffic = trafficLabel(system.shipJumpsLastHour);

  return (
    <button
      aria-label={`${system.name}, ${service}, security ${security}, ${traffic}`}
      className="road-system-cell"
      style={{
        "--cell-color": color,
        "--cell-delay": `${280 + Math.min(index, 42) * 16}ms`,
        "--cell-close-delay": `${Math.min(index, 42) * 6}ms`,
      } as CSSProperties}
      type="button"
    >
      <span className="road-system-tooltip" role="tooltip">
        <strong>{system.name}</strong>
        <span>Security {security}</span>
        <span>{service}</span>
        <span>{traffic}</span>
      </span>
    </button>
  );
}

function fallbackSystems(input: QuoteInput): RouteSystem[] {
  return [input.pickup, input.destination]
    .filter((system): system is SolarSystem => Boolean(system))
    .map((system) => ({
      id: system.id,
      name: system.name,
      securityDisplay: system.securityDisplay,
      serviceType: system.serviceType,
      color: system.color,
      shipJumpsLastHour: null,
    }));
}

function trafficLabel(shipJumpsLastHour: number | null | undefined) {
  if (shipJumpsLastHour === null || shipJumpsLastHour === undefined) {
    return "Traffic unavailable";
  }
  return `${shipJumpsLastHour.toLocaleString("en-US")} jumps last hour`;
}

function legendItems(systems: RouteSystem[]) {
  const items = systems.reduce<{ label: string; color: string }[]>((accumulator, system) => {
    const label = system.serviceType ?? "Unknown";
    const color = system.color ?? fallbackColor;
    if (!accumulator.some((item) => item.label === label)) {
      accumulator.push({ label, color });
    }
    return accumulator;
  }, []);

  return items.length > 0 ? items : [{ label: "Unknown", color: fallbackColor }];
}
