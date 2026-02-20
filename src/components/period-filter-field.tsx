"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PeriodValue = "all" | "this_month" | "last_month" | "this_week" | "last_week" | "custom";

const PERIOD_OPTIONS: Array<{ value: PeriodValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "custom", label: "Custom range" }
];

export function PeriodFilterField({
  name,
  value
}: {
  name: string;
  value: PeriodValue;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<PeriodValue>(value);

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const selectedLabel = useMemo(
    () => PERIOD_OPTIONS.find((option) => option.value === selectedValue)?.label ?? "All",
    [selectedValue]
  );

  function choose(nextValue: PeriodValue) {
    setSelectedValue(nextValue);
    setOpen(false);

    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.value = nextValue;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="input !w-44 cursor-pointer text-left"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {selectedLabel}
      </button>
      <input name={name} ref={inputRef} type="hidden" value={selectedValue} />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a7a70]"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>

      {open ? (
        <div className="absolute left-0 top-12 z-50 w-56 rounded-xl border border-[#ddd9d0] bg-white p-1 shadow-[0_8px_24px_rgba(20,18,12,0.14)]">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                option.value === selectedValue ? "bg-[#f7f4ef] text-[#1c3a28]" : "text-[#4a4a42] hover:bg-[#f7f4ef]"
              }`}
              onClick={() => choose(option.value)}
              type="button"
            >
              <span>{option.label}</span>
              {option.value === selectedValue ? <span className="text-xs">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
