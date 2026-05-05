import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Building2, Check, CircleDollarSign, Clock3, Copy, Gauge, PackageCheck, Route, Timer } from "lucide-react";

import type { QuoteInput, QuoteResult, ServiceWindowSummary } from "../types";
import { labelForSize, labelForSpeed } from "../data/quote";
import { formatFullIsk } from "../lib/format";

type QuotePanelProps = {
  input: QuoteInput;
  result: QuoteResult;
  serviceWindow: ServiceWindowSummary;
};

export function QuotePanel({ input, result, serviceWindow }: QuotePanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [routeMetaView, setRouteMetaView] = useState<{ closing: boolean; value: string } | null>(null);
  const speedLabel = labelForSpeed(input.speed);
  const isTransientPricingSync = result.source === "local" && result.blockedCode === "pricing_unavailable";
  const displayedBlockedReason = isTransientPricingSync ? undefined : result.blockedReason;
  const isSoftBlock = result.blockedCode === "minimum_collateral";
  const isRiskRestricted = result.blockedCode === "risk_restricted";
  const isBlocked = Boolean(displayedBlockedReason);
  const isStrongBlock = isBlocked && !isSoftBlock;
  const rewardHidden = isTransientPricingSync || result.blockedCode === "missing_collateral" || result.blockedCode === "minimum_collateral" || input.collateral < 10_000_000;
  const reward = isBlocked ? "Blocked" : formatFullIsk(result.estimate);
  const collateral = input.collateral > 0 ? formatFullIsk(input.collateral) : "Not set";
  const deadline = input.speed === "rush" ? "1 day" : "3 days";
  const contractTo = "Solane Run";
  const routeValue = `${result.route.jumps} jumps`;
  const routePair = input.pickup && input.destination
    ? `${input.pickup.name} - ${input.destination.name}`
    : null;
  const serviceWindowWarning = input.speed === "rush" && serviceWindow.level === "low_activity"
    ? rushWindowWarning(serviceWindow)
    : null;

  useEffect(() => {
    if (routePair) {
      setRouteMetaView({ closing: false, value: routePair });
      return;
    }

    setRouteMetaView((currentView) => {
      if (!currentView || currentView.closing) {
        return currentView;
      }
      return { ...currentView, closing: true };
    });

    const timeout = window.setTimeout(() => {
      setRouteMetaView((currentView) => (currentView?.closing ? null : currentView));
    }, 280);

    return () => window.clearTimeout(timeout);
  }, [routePair]);

  const copyValue = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((currentKey) => (currentKey === key ? null : currentKey));
    }, 1200);
  };

  return (
    <aside className={`quote-panel ${isStrongBlock ? "quote-panel-blocked" : ""} ${isRiskRestricted ? "quote-panel-restricted" : ""}`} id="pricing">
      <div className="quote-head">
        <strong>Contract packet</strong>
      </div>

      {displayedBlockedReason ? (
        <div className={`quote-lock-message ${isSoftBlock ? "quote-lock-message-soft" : ""}`} role="status">
          <AlertTriangle size={17} />
          <span>
            <b>{blockedReasonTitle(result.blockedCode)}</b>
            <small>{displayedBlockedReason}</small>
          </span>
        </div>
      ) : null}

      <div className="contract-packet contract-review-table">
        <PacketRow
          icon={<Route size={17} />}
          label="Route"
          meta={routeMetaView?.value}
          metaClosing={routeMetaView?.closing}
          value={routeValue}
        />
        <PacketRow
          icon={<Gauge size={17} />}
          label="Speed"
          value={speedLabel}
        />
        <PacketRow
          icon={<PackageCheck size={17} />}
          label="Size"
          value={labelForSize(input.size)}
        />
        <PacketRow
          copied={copiedKey === "contract-to"}
          icon={<Building2 size={17} />}
          label="Contract to"
          onCopy={() => copyValue("contract-to", contractTo)}
          value={contractTo}
        />
        <PacketRow
          icon={<CircleDollarSign size={17} />}
          label="Collateral"
          copied={copiedKey === "collateral"}
          onCopy={input.collateral > 0 ? () => copyValue("collateral", collateral) : undefined}
          value={collateral}
        />
        {!rewardHidden ? (
          <PacketRow
            copied={copiedKey === "reward"}
          icon={<CircleDollarSign size={17} />}
            label="Reward"
            onCopy={isBlocked ? undefined : () => copyValue("reward", reward)}
            value={reward}
          />
        ) : null}
        <PacketRow
          icon={<Clock3 size={17} />}
          label="Expiration"
          value={deadline}
        />
        <PacketRow
          icon={<Timer size={17} />}
          label="Days to complete"
          value={deadline}
        />
      </div>

      {!isRiskRestricted && serviceWindowWarning ? (
        <p className="quote-context-warning">
          {serviceWindowWarning}
        </p>
      ) : null}
    </aside>
  );
}

function rushWindowWarning(serviceWindow: ServiceWindowSummary) {
  if (serviceWindow.level === "low_activity") {
    return "Rush during Low Activity is handled with limited availability.";
  }
  return null;
}

function blockedReasonTitle(code: QuoteResult["blockedCode"]) {
  if (code === "minimum_collateral") {
    return "Risk desk minimum";
  }
  if (code === "collateral_limit") {
    return "Collateral limit";
  }
  if (code === "risk_restricted") {
    return "Route restricted";
  }
  if (code === "size_unavailable") {
    return "Size unavailable";
  }
  if (code === "speed_unavailable") {
    return "Speed unavailable";
  }
  if (code === "route_unavailable") {
    return "Route unavailable";
  }
  return "Quote blocked";
}

function PacketRow({
  copied,
  icon,
  label,
  meta,
  metaClosing,
  onCopy,
  value,
}: {
  copied?: boolean;
  icon: ReactNode;
  label: string;
  meta?: string | null;
  metaClosing?: boolean;
  onCopy?: () => void;
  value: string;
}) {
  return (
    <div className={`packet-row ${meta ? "packet-row-with-meta" : ""}`}>
      <span>
        {icon}
        {label}
      </span>
      <span className="copyable-value">
        <strong>{value}</strong>
        {meta ? <em className={metaClosing ? "route-meta-closing" : undefined}>{meta}</em> : null}
      </span>
      {onCopy ? <CopyButton copied={Boolean(copied)} label={`Copy ${label}`} onClick={onCopy} /> : null}
    </div>
  );
}

function CopyButton({
  copied,
  label,
  onClick,
}: {
  copied: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button aria-label={label} className="copy-button" onClick={onClick} type="button">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
