import { Activity, Calculator, RadioTower } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

import { fetchEsiStatus, type EsiStatus } from "../lib/api";
import { StatusBadge } from "./ui/StatusBadge";

type AppShellProps = {
  accentColor?: string;
  children: ReactNode;
  destinationColor?: string;
  serviceLabel?: string;
};

export function AppShell({ accentColor = "#19a8ff", children, destinationColor = accentColor, serviceLabel }: AppShellProps) {
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
    <div className="app-shell min-h-screen" data-service={serviceLabel ?? "Solane"} style={shellStyle}>
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
          <a className="nav-action" href="#route">
            <Activity size={17} />
            Route Intel
          </a>
        </nav>

        <div className="topbar-status">
          <StatusBadge>BETA</StatusBadge>
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
