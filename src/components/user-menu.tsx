"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({
  name,
  role,
  settingsHref,
  adminHref
}: {
  name: string;
  role?: string;
  settingsHref?: string;
  adminHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1c3a28] text-sm font-semibold text-white"
        onClick={() => setOpen((value) => !value)}
        title={name}
        type="button"
      >
        {getInitials(name)}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="border-b border-slate-100 px-2 pb-2">
            <p className="truncate text-sm font-medium text-slate-900">{name}</p>
            {role ? <p className="text-xs text-slate-500">{role}</p> : null}
          </div>
          <div className="mt-1 flex flex-col">
            {adminHref ? (
              <Link className="rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50" href={adminHref}>
                Platform Admin
              </Link>
            ) : null}
            {settingsHref ? (
              <Link className="rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50" href={settingsHref}>
                Settings
              </Link>
            ) : null}
            <Link className="rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/auth/logout">
              Sign out
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
