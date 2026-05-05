import type { CSSProperties } from "react";

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T | null;
  options: { disabled?: boolean; label: string; value: T }[];
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  const activeIndex = options.findIndex((option) => option.value === value);
  const trackStyle = {
    "--segmented-index": Math.max(0, activeIndex),
    "--segmented-count": options.length,
  } as CSSProperties;

  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      <div className={`segmented-track ${activeIndex < 0 ? "segmented-track-empty" : ""}`} style={trackStyle}>
        {activeIndex >= 0 ? <span className="segmented-thumb" aria-hidden="true" /> : null}
        {options.map((option) => (
          <button
            aria-pressed={option.value === value}
            className="segmented-option"
            disabled={option.disabled}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
