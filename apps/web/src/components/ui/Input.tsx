import type { InputHTMLAttributes } from "react";
import { useId } from "react";
import type { ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  accessory?: ReactNode;
};

export function Input({
  "aria-describedby": ariaDescribedBy,
  accessory,
  label,
  hint,
  className = "",
  type = "text",
  ...props
}: InputProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "-");
  const hintId = `input-hint-${reactId}`;

  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      <span className={accessory ? "field-input-row" : undefined}>
        <input aria-describedby={hint ? hintId : ariaDescribedBy} className="field-input" type={type} {...props} />
        {accessory}
      </span>
      {hint ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}
