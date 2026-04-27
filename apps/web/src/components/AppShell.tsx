import { Activity, Calculator, RadioTower } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

import { fetchEsiStatus, type EsiStatus } from "../lib/api";
import { StatusBadge } from "./ui/StatusBadge";

type AppShellProps = {
  accentColor?: string;
  children: ReactNode;
  destinationColor?: string;
  routeVisible?: boolean;
  serviceLabel?: string;
};

export function AppShell({
  accentColor = "#19a8ff",
  children,
  destinationColor = accentColor,
  routeVisible = false,
  serviceLabel,
}: AppShellProps) {
  const { status, healthy, eveTime } = useTranquilityStatus();
  const accentRgb = hexToRgb(accentColor);
  const destinationRgb = hexToRgb(destinationColor);
  const shellStyle = {
    "--service-accent": accentColor,
    "--service-accent-rgb": accentRgb,
    "--destination-accent": destinationColor,
    "--destination-accent-rgb": destinationRgb,
  } as CSSProperties;

  return (
    <div
      className={`app-shell min-h-screen ${routeVisible ? "app-shell-route-visible" : ""}`}
      data-service={serviceLabel ?? "Solane"}
      style={shellStyle}
    >
      <header className="topbar">
        <a aria-label="Solane Run dashboard" className="brand" href="/">
          <img alt="" src="/assets/logo-detoure.png" />
          <div>
            <strong>SOLANE RUN</strong>
            <span>Premium freight desk</span>
          </div>
        </a>

        <nav aria-label="Primary navigation" className="topnav">
          <a className="nav-action" href="#calculator">
            <Calculator size={17} />
            Calculator
          </a>
          <span aria-hidden="true" className="nav-separator" />
          <span className="nav-action nav-action-disabled" aria-disabled="true">
            <DiscordMark />
            Discord Server
          </span>
          <span aria-hidden="true" className="nav-separator" />
          <a className="nav-action" href="#route">
            <Activity size={17} />
            Route Intel
          </a>
        </nav>

        <div className="topbar-status">
          <StatusBadge>BETA</StatusBadge>
          <div className="service-status" aria-label="Service Status Active">
            <span className="status-pulse" aria-hidden="true" />
            <div>
              <strong>Service Status</strong>
              <span>Active</span>
            </div>
          </div>
          <div className={`signal ${healthy ? "signal-online" : "signal-offline"}`}>
            <RadioTower size={16} />
            <div>
              <strong>Tranquility</strong>
              <span>
                {status ? `${status.players.toLocaleString("en-US")} pilots` : "syncing"}
                {eveTime ? ` - ${eveTime} EVE` : ""}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

function DiscordMark() {
  return (
    <svg aria-hidden="true" className="discord-mark" fill="none" viewBox="0 0 24 24">
      <path
        d="M5.8 6.6c1.8-.8 3.9-1.2 6.2-1.2s4.4.4 6.2 1.2c1.5 2.3 2.3 4.9 2.4 7.8-1.9 1.5-3.8 2.3-5.8 2.6l-.9-1.4c1-.2 1.9-.6 2.7-1.2-.6.3-1.3.5-2 .7-.9.2-1.8.3-2.7.3s-1.8-.1-2.7-.3c-.7-.2-1.4-.4-2-.7.8.6 1.7 1 2.7 1.2L9 17c-2-.3-3.9-1.1-5.8-2.6.1-2.9.9-5.5 2.6-7.8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M9.2 11.7h.1M14.8 11.7h.1" stroke="currentColor" strokeLinecap="round" strokeWidth="3.1" />
    </svg>
  );
}

function useTranquilityStatus() {
  const [status, setStatus] = useState<EsiStatus | null>(null);
  const [healthy, setHealthy] = useState(false);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const nextStatus = await fetchEsiStatus();
        if (!mounted) {
          return;
        }
        setStatus(nextStatus);
        setHealthy(!nextStatus.vip);
      } catch {
        if (!mounted) {
          return;
        }
        setHealthy(false);
      }
    };

    refresh();
    const interval = window.setInterval(refresh, 30_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return {
    status,
    healthy,
    eveTime: status
      ? new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        })
      : "",
  };
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const bigint = Number.parseInt(normalized, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  return `${red}, ${green}, ${blue}`;
}
