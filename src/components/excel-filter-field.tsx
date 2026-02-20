"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
};

export function ExcelFilterField({
  name,
  placeholder,
  options,
  selected,
  autoSubmit = true
}: {
  name: string;
  placeholder: string;
  options: Option[];
  selected: string[];
  autoSubmit?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedValues, setSelectedValues] = useState<string[]>(selected);

  useEffect(() => {
    setSelectedValues(selected);
  }, [selected]);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, search]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function submitForm() {
    const form = rootRef.current?.closest("form");
    if (!form) {
      return;
    }
    requestAnimationFrame(() => {
      form.requestSubmit();
    });
  }

  function toggleValue(value: string) {
    const next = selectedValues.includes(value)
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value];

    setSelectedValues(next);
    if (autoSubmit) {
      submitForm();
    }
  }

  function setAll(checked: boolean) {
    const next = checked ? options.map((option) => option.value) : [];
    setSelectedValues(next);
    if (autoSubmit) {
      submitForm();
    }
  }

  const allSelected = options.length > 0 && selectedValues.length === options.length;
  const summary = selectedValues.length === 0
    ? placeholder
    : selectedValues.length === 1
      ? options.find((option) => option.value === selectedValues[0])?.label || placeholder
      : `${selectedValues.length} selected`;

  return (
    <div className="relative" ref={rootRef}>
      <button className="input !w-64 text-left" onClick={() => setOpen((value) => !value)} type="button">
        {summary}
      </button>
      <input name={name} type="hidden" value={selectedValues.join(",")} />

      {open && (
        <div className="absolute left-0 top-12 z-50 w-[360px] rounded-xl border border-[#ddd9d0] bg-white p-3 shadow-[0_8px_24px_rgba(20,18,12,0.14)]">
          <input
            className="input mb-2"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${placeholder.toLowerCase()}...`}
            value={search}
          />

          <label className="mb-2 flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-[#f7f4ef]">
            <input checked={allSelected} onChange={(event) => setAll(event.target.checked)} type="checkbox" />
            Select all
          </label>

          <div className="max-h-56 overflow-auto rounded-md border border-[#ede9e1] p-1">
            {filteredOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-[#f7f4ef]">
                <input
                  checked={selectedValues.includes(option.value)}
                  onChange={() => toggleValue(option.value)}
                  type="checkbox"
                />
                <span>{option.label}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <p className="px-2 py-2 text-sm text-[#7a7a70]">No matches</p>
            )}
          </div>

          <div className="mt-2 flex justify-end">
            <button className="button-secondary" onClick={() => setOpen(false)} type="button">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
