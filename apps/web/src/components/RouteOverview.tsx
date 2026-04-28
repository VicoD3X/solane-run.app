import type { CSSProperties, ReactNode } from "react";
import { Clock3, Radar, Shield, ShieldAlert, Waypoints } from "lucide-react";

import type {
  ContractAcceptanceSummary,
  QuoteInput,
  RouteResult,
  RouteRiskSummary,
  RouteSystem,
  RouteTrafficSummary,
  SolarSystem,
} from "../types";

type RouteOverviewProps = {
  acceptance: ContractAcceptanceSummary;
  closing?: boolean;
  input: QuoteInput;
  route: RouteResult;
};

const fallbackColor = "#8393a3";

export function RouteOverview({ acceptance, closing = false, input, route }: RouteOverviewProps) {
  const systems = route.routeSystems.length > 0 ? route.routeSystems : fallbackSystems(input);
  const routeTraffic = route.routeTraffic ?? routeTrafficFromSystems(systems);
  const routeRisk = route.routeRisk ?? fallbackRouteRisk();
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
        <div className="road-jump-metric" role="group" aria-label={`${route.jumps} total jumps`}>
          <Waypoints size={17} />
          <span>Total jumps</span>
          <strong>{route.jumps}</strong>
        </div>
      </header>

      <div className="road-intel-grid" aria-label="Route intelligence">
        <RoadIntelMetric
          detail={trafficDetail(routeTraffic)}
          icon={<Radar size={15} />}
          tone={`road-traffic-${routeTraffic.level}`}
          label="Route Traffic"
          value={routeTraffic.label}
        />
        <RoadIntelMetric
          detail={acceptanceDetail(acceptance)}
          icon={<Clock3 size={15} />}
          tone={`road-acceptance-${acceptance.level}`}
          label="Contract Acceptance"
          value={acceptance.label}
        />
        <RoadIntelMetric
          detail={riskDetail(routeRisk)}
          icon={<ShieldAlert size={15} />}
          tone={`road-risk-${routeRisk.level}`}
          label="Route Risk"
          value={routeRisk.label}
        />
      </div>

      <div className="road-overview-strip" aria-label="Route security timeline">
        {systems.map((system, index) => (
          <RouteCell
            key={`${system.id}-${index}`}
            index={index}
            total={systems.length}
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

function RoadIntelMetric({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <div className={`road-intel-card ${tone ?? ""}`}>
      <span>
        {icon}
        <b>{label}</b>
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function RouteCell({ index, system, total }: { index: number; system: RouteSystem; total: number }) {
  const color = system.color ?? fallbackColor;
  const service = system.serviceType ?? "Unknown";
  const security = system.securityDisplay ?? "unknown";
  const traffic = trafficLabel(system.shipJumpsLastHour);
  const edgeClass = tooltipEdgeClass(index, total);

  return (
    <button
      aria-label={`${system.name}, ${service}, security ${security}, ${traffic}`}
      className={`road-system-cell ${edgeClass}`}
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
        <span>{traffic}</span>
      </span>
    </button>
  );
}

function tooltipEdgeClass(index: number, total: number) {
  if (index < 6) {
    return "road-system-cell-start";
  }
  if (index >= total - 6) {
    return "road-system-cell-end";
  }
  return "";
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

function trafficDetail(traffic: RouteTrafficSummary) {
  if (traffic.totalShipJumpsLastHour === null) {
    return "Traffic unavailable";
  }

  const partial = traffic.coverage > 0 && traffic.coverage < 1 ? " - partial" : "";
  return `${traffic.totalShipJumpsLastHour.toLocaleString("en-US")} jumps last hour${partial}`;
}

function acceptanceDetail(acceptance: ContractAcceptanceSummary) {
  return acceptance.isFresh && acceptance.source === "corp-contracts"
    ? "Corp queue synced"
    : "Corp queue syncing";
}

function routeTrafficFromSystems(systems: RouteSystem[]): RouteTrafficSummary {
  const knownCounts = systems
    .map((system) => system.shipJumpsLastHour)
    .filter((value): value is number => value !== null && value !== undefined);
  const totalSystems = systems.length;
  const knownSystems = knownCounts.length;

  if (totalSystems === 0 || knownSystems === 0) {
    return {
      totalShipJumpsLastHour: null,
      knownSystems,
      totalSystems,
      coverage: 0,
      level: "unavailable",
      label: "Unavailable",
    };
  }

  const totalShipJumpsLastHour = knownCounts.reduce((total, value) => total + value, 0);
  const { label, level } = trafficLevel(totalShipJumpsLastHour);
  return {
    totalShipJumpsLastHour,
    knownSystems,
    totalSystems,
    coverage: Math.round((knownSystems / totalSystems) * 1000) / 1000,
    level,
    label,
  };
}

function trafficLevel(totalShipJumpsLastHour: number): Pick<RouteTrafficSummary, "label" | "level"> {
  if (totalShipJumpsLastHour < 1_000) {
    return { label: "Clear", level: "clear" };
  }
  if (totalShipJumpsLastHour < 7_000) {
    return { label: "Active", level: "active" };
  }
  if (totalShipJumpsLastHour < 12_000) {
    return { label: "Moderate", level: "moderate" };
  }
  if (totalShipJumpsLastHour < 20_100) {
    return { label: "Busy", level: "busy" };
  }
  return { label: "Heavy", level: "heavy" };
}

function fallbackRouteRisk(): RouteRiskSummary {
  return {
    affectedSystems: [],
    confidence: "unavailable",
    isBlocking: false,
    label: "Unavailable",
    lastSyncedAt: null,
    level: "unavailable",
    reason: "Risk telemetry unavailable.",
    trend: "unavailable",
  };
}

function riskDetail(risk: RouteRiskSummary) {
  if (risk.affectedSystems.length > 0) {
    const names = risk.affectedSystems.slice(0, 3).map((system) => system.name).join(", ");
    const suffix = risk.affectedSystems.length > 3 ? " +" : "";
    return `${names}${suffix} - ${risk.confidence}`;
  }
  if (risk.trend && risk.trend !== "stable" && risk.trend !== "unavailable") {
    return `${risk.trend} baseline - ${risk.confidence}`;
  }
  if (risk.reason) {
    return `${risk.reason} - ${risk.confidence}`;
  }
  return risk.confidence;
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
