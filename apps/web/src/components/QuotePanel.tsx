import { CircleDollarSign, PackageCheck, Route } from "lucide-react";

import type { QuoteInput, QuoteResult } from "../types";
import { labelForSize } from "../data/quote";
import { formatIsk } from "../lib/format";
import { StatusBadge } from "./ui/StatusBadge";

type QuotePanelProps = {
  input: QuoteInput;
  result: QuoteResult;
  message: string;
};

export function QuotePanel({ input, result, message }: QuotePanelProps) {
  return (
    <aside className="quote-panel" id="pricing">
      <div className="quote-head">
        <strong>Quote Summary</strong>
        <StatusBadge tone={result.route.source === "esi" ? "green" : "amber"}>
          {result.route.source === "esi" ? "ESI synced" : "Local route"}
        </StatusBadge>
      </div>

      <div className="estimate-block">
        <span>Total Price</span>
        <strong>{formatIsk(result.estimate)}</strong>
        {message ? <p>{message}</p> : null}
      </div>

      <div className="quote-lines">
        <div>
          <span>
            <Route size={16} />
            Route
          </span>
          <strong>{result.route.jumps} jumps</strong>
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
          <strong>{formatIsk(input.collateral)}</strong>
        </div>
      </div>

      <div className="fee-grid">
        <span>Base run</span>
        <strong>{formatIsk(result.base)}</strong>
        <span>Volume fee</span>
        <strong>{formatIsk(result.volumeFee)}</strong>
        <span>Collateral band</span>
        <strong>{formatIsk(result.collateralFee)}</strong>
        <span>Route modifier</span>
        <strong>{formatIsk(result.riskFee)}</strong>
      </div>

      <div className="quote-panel-reserve" aria-hidden="true" />
    </aside>
  );
}
