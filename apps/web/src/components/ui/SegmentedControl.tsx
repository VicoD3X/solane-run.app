import type { CSSProperties } from "react";

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const trackStyle = {
    "--segmented-index": activeIndex,
    "--segmented-count": options.length,
  } as CSSProperties;

  return (
    <fieldset className="segmented">
      <legend>{label}</legend>
      <div className="segmented-track" style={trackStyle}>
        <span className="segmented-thumb" aria-hidden="true" />
        {options.map((option) => (
          <button
            aria-pressed={option.value === value}
            className="segmented-option"
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
