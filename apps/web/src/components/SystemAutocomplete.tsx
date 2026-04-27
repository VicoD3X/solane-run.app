import { Search, X } from "lucide-react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useEffect, useId, useState } from "react";

import { fetchSystems } from "../lib/api";
import { sanitizeSystemQuery } from "../lib/guards";
import type { SolarSystem } from "../types";

type SystemAutocompleteProps = {
  label: string;
  onChange: (system: SolarSystem | null) => void;
  placeholder: string;
  value: SolarSystem | null;
};

export function SystemAutocomplete({ label, onChange, placeholder, value }: SystemAutocompleteProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "-");
  const inputId = `system-${reactId}`;
  const listId = `system-list-${reactId}`;
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<SolarSystem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value]);

  useEffect(() => {
    const trimmed = query.trim();
    if (value && trimmed === value.name) {
      setResults([]);
      setActiveIndex(-1);
      setLoading(false);
      return;
    }

    if (trimmed.length < 2) {
      setResults([]);
      setActiveIndex(-1);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetchSystems(trimmed)
        .then((systems) => {
          if (!cancelled) {
            setResults(systems);
            setActiveIndex(systems.length > 0 ? 0 : -1);
            setOpen(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setActiveIndex(-1);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, value]);

  const updateQuery = (nextQuery: string) => {
    const sanitizedQuery = sanitizeSystemQuery(nextQuery);
    setQuery(sanitizedQuery);
    setOpen(true);
    setActiveIndex(-1);
    if (value && sanitizedQuery !== value.name) {
      onChange(null);
    }
  };

  const selectSystem = (system: SolarSystem) => {
    onChange(system);
    setQuery(system.name);
    setResults([]);
    setActiveIndex(-1);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!open || results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((currentIndex) => (currentIndex + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((currentIndex) => (currentIndex <= 0 ? results.length - 1 : currentIndex - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectSystem(results[Math.max(0, activeIndex)]);
    }
  };

  return (
    <div className="system-combobox field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="combobox-shell">
        <Search aria-hidden="true" className="combobox-icon" size={17} />
        <input
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-option-${results[activeIndex]?.id}` : undefined}
          aria-controls={listId}
          aria-expanded={open && results.length > 0}
          autoComplete="off"
          className="field-input combobox-input"
          id={inputId}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => setOpen(results.length > 0)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          type="text"
          value={query}
        />
        {query ? (
          <button aria-label={`Clear ${label}`} className="combobox-clear" onClick={clear} type="button">
            <X size={16} />
          </button>
        ) : null}
      </div>

      {open && (results.length > 0 || loading) ? (
        <div className="combobox-menu" id={listId} role="listbox">
          {loading ? <div className="combobox-state">Scanning systems</div> : null}
          {results.map((system, index) => (
            <button
              aria-selected={index === activeIndex}
              className={`combobox-option ${index === activeIndex ? "combobox-option-active" : ""}`}
              id={`${listId}-option-${system.id}`}
              key={system.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSystem(system)}
              role="option"
              style={{ "--option-accent": system.color } as CSSProperties}
              type="button"
            >
              <span>
                <strong>{system.name}</strong>
                <small>{system.regionName}</small>
              </span>
              <span className="combobox-option-meta">
                <em>{system.serviceType}</em>
                <b>{system.securityDisplay}</b>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
