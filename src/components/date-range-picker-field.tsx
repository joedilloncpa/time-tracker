"use client";

import { useEffect, useRef, useState } from "react";

type ModeFieldName = "period" | "dateRange";

export function DateRangePickerField({
  modeFieldName,
  initialMode,
  from,
  to
}: {
  modeFieldName: ModeFieldName;
  initialMode: string;
  from?: string;
  to?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(initialMode === "custom");
  const [fromDate, setFromDate] = useState(from ?? "");
  const [toDate, setToDate] = useState(to ?? "");

  useEffect(() => {
    setIsCustomMode(initialMode === "custom");
  }, [initialMode]);

  useEffect(() => {
    setFromDate(from ?? "");
    setToDate(to ?? "");
  }, [from, to]);

  function submitIfValidCustomRange(nextFrom: string, nextTo: string) {
    const form = rootRef.current?.closest("form");
    if (!form) {
      return;
    }

    const fromTime = new Date(`${nextFrom}T00:00:00`).getTime();
    const toTime = new Date(`${nextTo}T00:00:00`).getTime();
    if (Number.isNaN(fromTime) || Number.isNaN(toTime) || toTime < fromTime) {
      return;
    }

    requestAnimationFrame(() => {
      form.requestSubmit();
    });
  }

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) {
      return;
    }

    const onFormChange = (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLSelectElement | null;
      if (!target || !target.name) {
        return;
      }

      if (target.name === modeFieldName) {
        const custom = target.value === "custom";
        setIsCustomMode(custom);
        if (!custom) {
          requestAnimationFrame(() => {
            form.requestSubmit();
          });
        }
        return;
      }

      if (target.name === "dateFrom") {
        const nextFrom = target.value;
        setFromDate(nextFrom);
        if (isCustomMode && nextFrom && toDate) {
          submitIfValidCustomRange(nextFrom, toDate);
        }
        return;
      }

      if (target.name === "dateTo") {
        const nextTo = target.value;
        setToDate(nextTo);
        if (isCustomMode && fromDate && nextTo) {
          submitIfValidCustomRange(fromDate, nextTo);
        }
        return;
      }

      requestAnimationFrame(() => {
        form.requestSubmit();
      });
    };

    form.addEventListener("change", onFormChange);
    return () => form.removeEventListener("change", onFormChange);
  }, [fromDate, isCustomMode, modeFieldName, toDate]);

  return (
    <div className={isCustomMode ? "flex items-center gap-2" : "hidden"} ref={rootRef}>
      <input
        className="input !w-[170px]"
        max={toDate || undefined}
        name="dateFrom"
        onChange={(event) => setFromDate(event.target.value)}
        type="date"
        value={fromDate}
      />
      <span className="text-sm text-[#7a7a70]">to</span>
      <input
        className="input !w-[170px]"
        min={fromDate || undefined}
        name="dateTo"
        onChange={(event) => setToDate(event.target.value)}
        type="date"
        value={toDate}
      />
    </div>
  );
}
