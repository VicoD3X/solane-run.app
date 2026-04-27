import { useState } from "react";
import type { ReactNode } from "react";
import { Building2, Check, CircleDollarSign, Clock3, Copy, Gauge, PackageCheck, Route, Timer } from "lucide-react";

import type { QuoteInput, QuoteResult } from "../types";
import { labelForSize, labelForSpeed } from "../data/quote";
import { formatFullIsk } from "../lib/format";

type QuotePanelProps = {
  input: QuoteInput;
  result: QuoteResult;
};

export function QuotePanel({ input, result }: QuotePanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const speedLabel = labelForSpeed(input.speed);
  const reward = formatFullIsk(result.estimate);
  const collateral = formatFullIsk(input.collateral);
  const deadline = input.speed === "rush" ? "1 day" : "3 days";
  const contractTo = "Solane Run";

  const copyValue = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((currentKey) => (currentKey === key ? null : currentKey));
    }, 1200);
  };

  return (
    <aside className="quote-panel" id="pricing">
      <div className="quote-head">
        <strong>Quote Summary</strong>
      </div>

      <div className="quote-lines run-terms">
        <div>
          <span>
            <Route size={16} />
            Route
          </span>
          <strong>{result.route.jumps} jumps</strong>
        </div>
        <div>
          <span>
            <Gauge size={16} />
            Speed
          </span>
          <strong>{speedLabel}</strong>
        </div>
        <div>
          <span>
            <PackageCheck size={16} />
            Size
          </span>
          <strong>{labelForSize(input.size)}</strong>
        </div>
        <div>
          <span>
            <CircleDollarSign size={16} />
            Collateral
          </span>
          <span className="copyable-value">
            <strong>{collateral}</strong>
          </span>
        </div>
      </div>

      <div className="contract-packet">
        <div className="contract-packet-head">
          <span>Contract Packet</span>
          <strong>{speedLabel}</strong>
        </div>

        <PacketRow
          copied={copiedKey === "contract-to"}
          icon={<Building2 size={15} />}
          label="Contract to"
          onCopy={() => copyValue("contract-to", contractTo)}
          value={contractTo}
        />
        <PacketRow
          copied={copiedKey === "reward"}
          icon={<CircleDollarSign size={15} />}
          label="Reward"
          onCopy={() => copyValue("reward", reward)}
          value={reward}
        />
        <PacketRow
          copied={copiedKey === "collateral"}
          icon={<CircleDollarSign size={15} />}
          label="Collateral"
          onCopy={() => copyValue("collateral", collateral)}
          value={collateral}
        />
        <PacketRow
          icon={<Clock3 size={15} />}
          label="Expiration"
          value={deadline}
        />
        <PacketRow
          icon={<Timer size={15} />}
          label="Completion"
          value={deadline}
        />
      </div>

      <div className="quote-panel-reserve" aria-hidden="true" />
    </aside>
  );
}

function PacketRow({
  copied,
  icon,
  label,
  onCopy,
  value,
}: {
  copied?: boolean;
  icon: ReactNode;
  label: string;
  onCopy?: () => void;
  value: string;
}) {
  return (
    <div className="packet-row">
      <span>
        {icon}
        {label}
      </span>
      <span className="copyable-value">
        <strong>{value}</strong>
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
