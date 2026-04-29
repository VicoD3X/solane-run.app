import { AlertTriangle, ArrowLeft, BadgeCheck, Coins, Copy, GitBranch, MapPinned, Radar, ShieldAlert, Zap } from "lucide-react";
import type { CSSProperties, FocusEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  fetchCorruptionIntelDetail,
  fetchCrossroadsIntelDetail,
  fetchGoldIntelDetail,
  fetchRouteIntelOverview,
} from "../lib/api";
import type {
  CorruptionIntelDetail,
  CorruptionIntelItem,
  CrossroadsIntelDetail,
  CrossroadsIntelItem,
  GatecheckGate,
  GoldIntelDetail,
  GoldIntelItem,
  RouteIntelOverview,
  RouteSystem,
} from "../types";

type ActiveIntel =
  | { type: "crossroads"; systemId: number }
  | { type: "gold"; routeId: string }
  | { type: "corruption"; systemId: number };

type IntelDetailState = {
  crossroads: CrossroadsIntelDetail | null;
  gold: GoldIntelDetail | null;
  corruption: CorruptionIntelDetail | null;
  loading: boolean;
  error: string | null;
};

type CorridorTooltipState = {
  arrowX: number;
  index: number;
  left: number;
  placement: "top" | "bottom";
  system: RouteSystem;
  top: number;
};

const initialDetailState: IntelDetailState = {
  corruption: null,
  crossroads: null,
  error: null,
  gold: null,
  loading: false,
};

export function RouteIntelPage() {
  const [overview, setOverview] = useState<RouteIntelOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [activeIntel, setActiveIntel] = useState<ActiveIntel | null>(null);
  const [closingIntel, setClosingIntel] = useState<ActiveIntel | null>(null);
  const [detail, setDetail] = useState<IntelDetailState>(initialDetailState);
  const [esiRecoveryKey, setEsiRecoveryKey] = useState(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportCopied, setSupportCopied] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const supportRef = useRef<HTMLDivElement | null>(null);
  const supportCopyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleEsiRestored = () => {
      setEsiRecoveryKey((currentKey) => currentKey + 1);
    };

    window.addEventListener("solane:esi-restored", handleEsiRestored);
    return () => window.removeEventListener("solane:esi-restored", handleEsiRestored);
  }, []);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const nextOverview = await fetchRouteIntelOverview();
        if (!mounted) {
          return;
        }
        setOverview(nextOverview);
        setOverviewError(null);
      } catch {
        if (!mounted) {
          return;
        }
        setOverview(null);
        setOverviewError("Route Intel is temporarily unavailable.");
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [esiRecoveryKey]);

  useEffect(() => {
    let mounted = true;

    const loadDetail = async () => {
      if (!activeIntel) {
        setDetail(initialDetailState);
        return;
      }

      setDetail({ ...initialDetailState, loading: true });
      try {
        const nextDetail = activeIntel.type === "gold"
          ? { corruption: null, crossroads: null, gold: await fetchGoldIntelDetail(activeIntel.routeId) }
          : activeIntel.type === "crossroads"
            ? { corruption: null, crossroads: await fetchCrossroadsIntelDetail(activeIntel.systemId), gold: null }
            : { corruption: await fetchCorruptionIntelDetail(activeIntel.systemId), crossroads: null, gold: null };
        if (!mounted) {
          return;
        }
        setDetail({ ...nextDetail, error: null, loading: false });
      } catch {
        if (!mounted) {
          return;
        }
        setDetail({ ...initialDetailState, error: "Detail telemetry is temporarily unavailable." });
      }
    };

    void loadDetail();
    return () => {
      mounted = false;
    };
  }, [activeIntel, esiRecoveryKey]);

  const visibleGold = useMemo(() => overview?.gold.items ?? [], [overview]);
  const visibleCorruption = useMemo(() => overview?.corruption.items ?? [], [overview]);

  const openIntel = (nextIntel: ActiveIntel) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosingIntel(null);
    setActiveIntel(nextIntel);
  };

  const closeIntel = () => {
    if (!activeIntel) {
      return;
    }

    setClosingIntel(activeIntel);
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setActiveIntel(null);
      setClosingIntel(null);
      closeTimerRef.current = null;
    }, 220);
  };

  useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    if (supportCopyTimerRef.current !== null) {
      window.clearTimeout(supportCopyTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!supportOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (supportRef.current?.contains(event.target as Node)) {
        return;
      }
      setSupportOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSupportOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [supportOpen]);

  const donationCharacter = overview?.donationCharacter ?? "Vito Solane";
  const copyDonationCharacter = async () => {
    try {
      await navigator.clipboard.writeText(donationCharacter);
      setSupportCopied(true);
      if (supportCopyTimerRef.current !== null) {
        window.clearTimeout(supportCopyTimerRef.current);
      }
      supportCopyTimerRef.current = window.setTimeout(() => {
        setSupportCopied(false);
        supportCopyTimerRef.current = null;
      }, 1200);
    } catch {
      setSupportCopied(false);
    }
  };

  return (
    <>
      <section className="route-intel-cockpit" aria-labelledby="route-intel-title">
        <header className="route-intel-page-head">
          <h1 id="route-intel-title">Route Intel</h1>
          <div className="route-intel-support" ref={supportRef}>
            <button
              aria-expanded={supportOpen}
              aria-haspopup="dialog"
              className="route-intel-donation"
              type="button"
              onClick={() => setSupportOpen((isOpen) => !isOpen)}
            >
              <Coins size={15} />
              <span>Support the project!</span>
            </button>
            <div className={`route-intel-support-popover ${supportOpen ? "route-intel-support-popover-open" : ""}`} role="dialog" aria-label="Support Solane Run">
              <strong>Independent project</strong>
              <p>Solane Run is a solo-driven EVE freight tool, built and operated independently.</p>
              <div className="route-intel-support-donation-card">
                <small>ISK donations accepted on</small>
                <span className="route-intel-support-character">
                  <b>{donationCharacter}</b>
                  <button aria-label={`Copy ${donationCharacter}`} type="button" onClick={copyDonationCharacter}>
                    <Copy size={12} />
                  </button>
                </span>
              </div>
              {supportCopied ? <em>Copied</em> : null}
              <span className="route-intel-support-thanks">Thank you for supporting the service.</span>
            </div>
          </div>
        </header>

        {overviewError ? (
          <div className="route-intel-error" role="status">
            <AlertTriangle size={16} />
            {overviewError}
          </div>
        ) : null}

        <div className="route-intel-stack">
          <IntelPanel
            active={activeIntel?.type === "crossroads"}
            closing={closingIntel?.type === "crossroads"}
            kicker="HighSec pipes"
            metric={overview?.crossroads.label ?? "Syncing"}
            onBack={closeIntel}
            title="Crossroads Intel"
          >
            {activeIntel?.type === "crossroads" ? (
              <CrossroadsDetail detail={detail} />
            ) : (
              <CrossroadsList
                items={overview?.crossroads.items ?? []}
                onSelect={(systemId) => openIntel({ systemId, type: "crossroads" })}
              />
            )}
          </IntelPanel>

          <IntelPanel
            active={activeIntel?.type === "gold"}
            closing={closingIntel?.type === "gold"}
            kicker="Popular Corridors"
            metric={`${overview?.gold.items.length ?? 0} routes`}
            onBack={closeIntel}
            title="Gold Intel"
          >
            {activeIntel?.type === "gold" ? (
              <GoldDetail detail={detail} />
            ) : (
              <GoldList items={visibleGold} onSelect={(routeId) => openIntel({ routeId, type: "gold" })} />
            )}
          </IntelPanel>

          <IntelPanel
            active={activeIntel?.type === "corruption"}
            closing={closingIntel?.type === "corruption"}
            kicker="Insurgency watch"
            metric={<InsurgencyMetric label={overview?.corruption.label ?? "0 LVL4 / 0 LVL5"} />}
            onBack={closeIntel}
            title="Corruption Intel"
          >
            {activeIntel?.type === "corruption" ? (
              <CorruptionDetail detail={detail} />
            ) : (
              <CorruptionList
                items={visibleCorruption}
                onSelect={(systemId) => openIntel({ systemId, type: "corruption" })}
              />
            )}
          </IntelPanel>
        </div>
      </section>

      <footer className="site-footer">
        <strong>Solane Run</strong>
        <span>Premium & independant freight shipping service</span>
        <span>{"\u00a9"} 2026 Victor A. All rights reserved.</span>
      </footer>
    </>
  );
}

function IntelPanel({
  active,
  children,
  closing,
  kicker,
  metric,
  onBack,
  onOpen,
  title,
}: {
  active: boolean;
  children: ReactNode;
  closing?: boolean;
  kicker: string;
  metric: ReactNode;
  onBack: () => void;
  onOpen?: () => void;
  title: string;
}) {
  return (
    <article className={`route-intel-block ${active ? "route-intel-block-active" : ""} ${closing ? "route-intel-block-closing" : ""}`}>
      <header className="route-intel-block-head">
        <div>
          <span>{kicker}</span>
          <div className="route-intel-title-row">
            {active ? (
              <button className="route-intel-back-icon" type="button" onClick={onBack} aria-label={`Back from ${title}`}>
                <ArrowLeft size={15} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="route-intel-block-actions">
          <strong>{metric}</strong>
          {!active && onOpen ? (
            <button type="button" onClick={onOpen}>
              Open
            </button>
          ) : null}
        </div>
      </header>
      <div className={`route-intel-block-body ${active ? "route-intel-window-open" : "route-intel-window-list"} ${closing ? "route-intel-window-closing" : ""}`}>
        {children}
      </div>
    </article>
  );
}

function InsurgencyMetric({ label }: { label: string }) {
  const match = label.match(/(\d+)\s*LVL4\s*\/\s*(\d+)\s*LVL5/i);
  if (!match) {
    return <>{label}</>;
  }

  return (
    <span className="route-intel-level-metric" aria-label={label}>
      <span className="route-intel-level-metric-lvl4"><b>{match[1]}</b> LVL4</span>
      <span className="route-intel-level-metric-lvl5"><b>{match[2]}</b> LVL5</span>
    </span>
  );
}

function EmptyIntel({ icon, label, title }: { icon: ReactNode; label: string; title: string }) {
  return (
    <div className="route-intel-empty">
      <i>{icon}</i>
      <div>
        <strong>{title}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function CrossroadsList({ items, onSelect }: { items: CrossroadsIntelItem[]; onSelect: (systemId: number) => void }) {
  if (items.length === 0) {
    return (
      <EmptyIntel
        icon={<Radar size={18} />}
        label="Dangerous HighSec pipes are syncing."
        title="Crossroads unavailable"
      />
    );
  }

  return (
    <div className="route-intel-crossroads-grid">
      {items.map((item) => (
        <button
          key={item.system.id}
          className={`route-intel-crossroads-row route-intel-severity-${item.severity}`}
          onClick={() => onSelect(item.system.id)}
          type="button"
        >
          <span>{item.system.name}</span>
          <strong className="route-intel-status-chip">{item.label}</strong>
          <i>{formatCrossroadsKills(item.shipKillsLastHour)} <small>Kills</small></i>
        </button>
      ))}
    </div>
  );
}

function CrossroadsDetail({ detail }: { detail: IntelDetailState }) {
  if (detail.loading) {
    return <EmptyIntel icon={<MapPinned size={18} />} label="Loading Crossroads telemetry." title="System syncing" />;
  }
  if (detail.error || !detail.crossroads) {
    return <EmptyIntel icon={<AlertTriangle size={18} />} label={detail.error ?? "Select a Crossroads system."} title="Detail unavailable" />;
  }

  const item = detail.crossroads;
  return (
    <div className={`route-intel-detail route-intel-detail-crossroads route-intel-detail-${item.severity}`}>
      <div className="route-intel-detail-summary route-intel-system-head">
        <strong>{item.system?.name ?? "Crossroads system"}</strong>
        <span className={`route-intel-status-chip route-intel-status-${item.severity}`}>{item.label}</span>
      </div>
      <div className="route-intel-metrics route-intel-command-metrics route-intel-corruption-metrics">
        <Metric label="Ship jumps" value={formatMetric(item.shipJumpsLastHour)} />
        <Metric label="Ships destroyed" value={formatMetric(item.shipKillsLastHour)} />
        <Metric label="Pods destroyed" value={formatMetric(item.podKillsLastHour)} />
        <Metric label="ISK destroyed" value={formatIsk(item.zkillIntel?.totalValue)} />
      </div>
      <GateKillStrip gates={item.gates} />
      <p>{item.summary}</p>
    </div>
  );
}

function GoldList({ items, onSelect }: { items: GoldIntelItem[]; onSelect: (routeId: string) => void }) {
  if (items.length === 0) {
    return <EmptyIntel icon={<BadgeCheck size={18} />} label="Golden routes are syncing." title="No route loaded" />;
  }

  return (
    <div className="route-intel-route-grid">
      {items.map((item) => (
        <button key={item.routeId} className="route-intel-route-row" onClick={() => onSelect(item.routeId)} type="button">
          <span>{item.origin.name} <b>{"<->"}</b> {item.destination.name}</span>
        </button>
      ))}
    </div>
  );
}

function GoldDetail({ detail }: { detail: IntelDetailState }) {
  if (detail.loading) {
    return <EmptyIntel icon={<GitBranch size={18} />} label="Loading route waypoints." title="Route syncing" />;
  }
  if (detail.error || !detail.gold) {
    return <EmptyIntel icon={<AlertTriangle size={18} />} label={detail.error ?? "Select a Golden route."} title="Detail unavailable" />;
  }

  const gold = detail.gold;
  const traffic = detail.gold.routeTraffic;
  const risk = detail.gold.routeRisk;
  return (
    <div className="route-intel-detail route-intel-detail-gold">
      <div className="route-intel-detail-summary route-intel-corridor-head">
        <strong>{gold.origin.name} - {gold.destination.name}</strong>
      </div>
      <div className="route-intel-metrics route-intel-command-metrics route-intel-corridor-metrics">
        <Metric label="Jumps" value={formatMetric(gold.jumps)} />
        <Metric label="Traffic" value={traffic?.label ?? "Syncing"} />
        <Metric label="Risk" value={risk?.label ?? "Syncing"} />
        <Metric label="Ships destroyed" value={formatMetric(traffic?.totalShipKillsLastHour)} />
        <Metric label="ISK destroyed" value={formatIsk(gold.zkillIntel?.totalValue)} />
      </div>
      <CorridorWaypointPath systems={gold.systems} />
    </div>
  );
}

function CorridorWaypointPath({ systems }: { systems: RouteSystem[] }) {
  const pathRef = useRef<HTMLDivElement | null>(null);
  const [density, setDensity] = useState(() => initialCorridorDensity());
  const [tooltip, setTooltip] = useState<CorridorTooltipState | null>(null);

  useEffect(() => {
    setDensity(initialCorridorDensity());
    setTooltip(null);
  }, [systems.length]);

  useLayoutEffect(() => {
    const path = pathRef.current;
    const body = path?.closest(".route-intel-block-body") as HTMLElement | null;
    if (!path || !body) {
      return;
    }

    let frame = 0;
    let cancelled = false;

    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        const overflow = body.scrollHeight - body.clientHeight;

        setDensity((current) => {
          if (overflow > 2 && current < 4) {
            return current + 1;
          }
          return current;
        });
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(path);
    window.addEventListener("resize", measure);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [density, systems.length]);

  const showTooltip = (system: RouteSystem, index: number, element: HTMLElement) => {
    setTooltip(positionCorridorTooltip(system, index, element.getBoundingClientRect()));
  };

  const handlePointerEnter = (system: RouteSystem, index: number, event: PointerEvent<HTMLSpanElement>) => {
    showTooltip(system, index, event.currentTarget);
  };

  const handlePointerMove = (system: RouteSystem, index: number, event: PointerEvent<HTMLSpanElement>) => {
    showTooltip(system, index, event.currentTarget);
  };

  const handleFocus = (system: RouteSystem, index: number, event: FocusEvent<HTMLSpanElement>) => {
    showTooltip(system, index, event.currentTarget);
  };

  return (
    <>
      <div
        ref={pathRef}
        className={`route-intel-waypoints route-intel-corridor-path route-intel-corridor-density-${density}`}
        aria-label="Golden route waypoints"
      >
        {systems.map((system, index) => (
          <span
            key={`${system.id}-${index}`}
            aria-describedby={tooltip?.index === index ? "corridor-system-tooltip" : undefined}
            aria-label={`${system.name}, ${system.securityDisplay ?? "unknown security"}, ${formatMetric(system.shipKillsLastHour)} ships destroyed`}
            className={`${index === 0 ? "route-intel-waypoint-edge" : ""} ${index === systems.length - 1 ? "route-intel-waypoint-edge" : ""}`}
            role="button"
            style={{ "--waypoint-color": system.color ?? "#6fcf97" } as CSSProperties}
            tabIndex={0}
            onBlur={() => setTooltip(null)}
            onFocus={(event) => handleFocus(system, index, event)}
            onPointerEnter={(event) => handlePointerEnter(system, index, event)}
            onPointerLeave={() => setTooltip(null)}
            onPointerMove={(event) => handlePointerMove(system, index, event)}
          >
            <i>{index + 1}</i>
            <b>{system.name}</b>
          </span>
        ))}
      </div>

      {tooltip
        ? createPortal(
          <CorridorSystemTooltip tooltip={tooltip} />,
          document.body,
        )
        : null}
    </>
  );
}

function CorridorSystemTooltip({ tooltip }: { tooltip: CorridorTooltipState }) {
  const style = {
    "--tooltip-arrow-x": `${tooltip.arrowX}px`,
    left: tooltip.left,
    top: tooltip.top,
  } as CSSProperties;

  return (
    <aside
      id="corridor-system-tooltip"
      className={`route-intel-corridor-tooltip route-intel-corridor-tooltip-${tooltip.placement}`}
      role="tooltip"
      style={style}
    >
      <div className="route-intel-corridor-tooltip-head">
        <strong>{tooltip.system.name}</strong>
        <span>{tooltip.system.securityDisplay ?? "Unknown"} sec</span>
      </div>
      <div className="route-intel-corridor-tooltip-service">
        <i style={{ "--waypoint-color": tooltip.system.color ?? "#6fcf97" } as CSSProperties} />
        {tooltip.system.serviceType ?? "Unknown space"}
      </div>
      <div className="route-intel-corridor-tooltip-grid">
        <span>
          Jumps
          <b>{formatMetric(tooltip.system.shipJumpsLastHour)}</b>
        </span>
        <span>
          Ships
          <b>{formatMetric(tooltip.system.shipKillsLastHour)}</b>
        </span>
        <span>
          Pods
          <b>{formatMetric(tooltip.system.podKillsLastHour)}</b>
        </span>
        <span>
          ISK
          <b>{formatIsk(tooltip.system.zkillIntel?.totalValue)}</b>
        </span>
      </div>
    </aside>
  );
}

function positionCorridorTooltip(system: RouteSystem, index: number, rect: DOMRect): CorridorTooltipState {
  const tooltipWidth = 252;
  const viewportMargin = 12;
  const anchorX = rect.left + rect.width / 2;
  const unclampedLeft = anchorX - tooltipWidth / 2;
  const maxLeft = window.innerWidth - tooltipWidth - viewportMargin;
  const left = Math.max(viewportMargin, Math.min(unclampedLeft, maxLeft));
  const arrowX = Math.max(18, Math.min(anchorX - left, tooltipWidth - 18));
  const hasTopRoom = rect.top > 154;

  return {
    arrowX,
    index,
    left,
    placement: hasTopRoom ? "top" : "bottom",
    system,
    top: hasTopRoom ? rect.top - 10 : rect.bottom + 10,
  };
}

function initialCorridorDensity() {
  return 0;
}

function CorruptionList({ items, onSelect }: { items: CorruptionIntelItem[]; onSelect: (systemId: number) => void }) {
  if (items.length === 0) {
    return <EmptyIntel icon={<ShieldAlert size={18} />} label="No level 5 or 4 corruption systems detected." title="No active corruption" />;
  }

  return (
    <div className="route-intel-corruption-grid">
      {items.map((item) => (
        <button
          key={item.system.id}
          className={`route-intel-corruption-row route-intel-severity-${item.severity}`}
          onClick={() => onSelect(item.system.id)}
          type="button"
        >
          <span>{item.system.name}</span>
          <strong className="route-intel-status-chip">LVL {item.corruptionState}</strong>
          <i>{Math.round(item.corruptionPercentage)} <small>Corruption</small></i>
        </button>
      ))}
    </div>
  );
}

function CorruptionDetail({ detail }: { detail: IntelDetailState }) {
  if (detail.loading) {
    return <EmptyIntel icon={<Zap size={18} />} label="Loading corruption telemetry." title="System syncing" />;
  }
  if (detail.error || !detail.corruption) {
    return <EmptyIntel icon={<AlertTriangle size={18} />} label={detail.error ?? "Select a corrupted system."} title="Detail unavailable" />;
  }

  const item = detail.corruption;
  return (
    <div className={`route-intel-detail route-intel-detail-corruption route-intel-detail-${item.severity}`}>
      <div className="route-intel-detail-summary route-intel-system-head">
        <strong>{item.system.name}</strong>
        <span className="route-intel-status-chip">LVL {item.corruptionState}</span>
      </div>
      <div className="route-intel-metrics route-intel-command-metrics">
        <Metric label="Corruption" value={`${Math.round(item.corruptionPercentage)}%`} />
        <Metric label="Suppression" value={`${Math.round(item.suppressionPercentage)}%`} />
        <Metric label="Ship jumps" value={formatMetric(item.shipJumpsLastHour)} />
        <Metric label="Ships destroyed" value={formatMetric(item.shipKillsLastHour)} />
      </div>
      <GateKillStrip gates={item.gates} />
      <p>{item.summary}</p>
    </div>
  );
}

function GateKillStrip({ gates }: { gates: GatecheckGate[] }) {
  if (gates.length === 0) {
    return <p>Gate kill attribution unavailable.</p>;
  }

  return (
    <div className="route-intel-gate-kill-strip" aria-label="Gate kills last hour">
      {gates.map((gate) => (
        <span key={gate.id} className={gate.killsLastHour > 0 ? "route-intel-gate-hot" : ""}>
          <small>{formatGateLabel(gate)}</small>
          <b>{gate.killsLastHour}</b>
          <i>Kills</i>
        </span>
      ))}
    </div>
  );
}

function formatGateLabel(gate: GatecheckGate) {
  const label = gate.destinationSystemName ?? gate.name;
  return /\bgate$/i.test(label) ? label : `${label} Gate`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label}
      <b>{value}</b>
    </span>
  );
}

function formatMetric(value: number | null | undefined) {
  return value === null || value === undefined ? "Unavailable" : value.toLocaleString("en-US");
}

function formatCrossroadsKills(value: number | null | undefined) {
  return value === null || value === undefined ? "0" : value.toLocaleString("en-US");
}

function formatIsk(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Unavailable";
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : 1)}B ISK`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M ISK`;
  }
  return `${value.toLocaleString("en-US")} ISK`;
}
