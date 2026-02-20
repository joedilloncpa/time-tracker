"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserContext } from "@/lib/types";
import { INTERNAL_FIRM_CLIENT_CODE } from "@/lib/firm-work";
import { UserMenu } from "@/components/user-menu";

type TimerClientOption = {
  id: string;
  name: string;
  code?: string | null;
  workstreams: Array<{
    id: string;
    name: string;
  }>;
};

function IconTimer() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 2h6" />
      <path d="M12 8v5l3 2" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  );
}

function IconCog() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z" />
    </svg>
  );
}

const navItems = [
  { href: "dashboard", label: "Dashboard" },
  { href: "clients", label: "Clients" },
  { href: "workstreams", label: "Workstreams" }
];

export function TopMenu({
  firmSlug,
  user,
  timerClients
}: {
  firmSlug: string;
  user: UserContext;
  timerClients: TimerClientOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [openStart, setOpenStart] = useState(false);
  const [startMode, setStartMode] = useState<"client" | "firm">("client");
  const [startClientId, setStartClientId] = useState("");
  const [startWorkstreamId, setStartWorkstreamId] = useState("");
  const [startNotes, setStartNotes] = useState("");
  const [startError, setStartError] = useState("");
  const [startSaving, setStartSaving] = useState(false);

  const [openAdd, setOpenAdd] = useState(false);
  const [addMode, setAddMode] = useState<"client" | "firm">("client");
  const [addClientId, setAddClientId] = useState("");
  const [addWorkstreamId, setAddWorkstreamId] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addStartTime, setAddStartTime] = useState("");
  const [addEndTime, setAddEndTime] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const firmClient = useMemo(
    () => timerClients.find((client) => client.code === INTERNAL_FIRM_CLIENT_CODE || client.name === "Firm"),
    [timerClients]
  );
  const clientWorkAreas = useMemo(
    () => timerClients.filter((client) => client.id !== firmClient?.id),
    [firmClient?.id, timerClients]
  );
  const firmWorkstreamOptions = useMemo(
    () => firmClient?.workstreams ?? [],
    [firmClient?.workstreams]
  );

  const startWorkstreamOptions = useMemo(() => {
    if (startMode === "firm") {
      return firmWorkstreamOptions;
    }
    if (!startClientId) {
      return [];
    }
    return clientWorkAreas.find((client) => client.id === startClientId)?.workstreams ?? [];
  }, [clientWorkAreas, firmWorkstreamOptions, startClientId, startMode]);

  const addWorkstreamOptions = useMemo(() => {
    if (addMode === "firm") {
      return firmWorkstreamOptions;
    }
    if (!addClientId) {
      return [];
    }
    return clientWorkAreas.find((client) => client.id === addClientId)?.workstreams ?? [];
  }, [addClientId, addMode, clientWorkAreas, firmWorkstreamOptions]);

  async function onStartTimer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStartError("");
    setStartSaving(true);
    const effectiveClientId = startMode === "firm" ? (firmClient?.id ?? "") : startClientId;
    if (!effectiveClientId || !startWorkstreamId) {
      setStartError("Client/work area and workstream are required.");
      setStartSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/timer/start?firmSlug=${firmSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: effectiveClientId,
          workstreamId: startWorkstreamId,
          notes: startNotes.trim() || null
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to start timer");
      }

      setOpenStart(false);
      setStartClientId("");
      setStartWorkstreamId("");
      setStartNotes("");
      router.push(`/${firmSlug}/dashboard`);
      router.refresh();
    } catch (submitError) {
      setStartError(submitError instanceof Error ? submitError.message : "Failed to start timer");
    } finally {
      setStartSaving(false);
    }
  }

  async function onAddTimer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError("");

    const effectiveClientId = addMode === "firm" ? (firmClient?.id ?? "") : addClientId;
    if (!effectiveClientId || !addWorkstreamId || !addDate || !addStartTime || !addEndTime) {
      setAddError("Work area, workstream, date, start time, and end time are required.");
      return;
    }

    const startAt = new Date(`${addDate}T${addStartTime}:00`);
    const endAt = new Date(`${addDate}T${addEndTime}:00`);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      setAddError("End time must be later than start time.");
      return;
    }

    const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000);

    setAddSaving(true);
    try {
      const response = await fetch(`/api/time-entries?firmSlug=${firmSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: effectiveClientId,
          workstreamId: addWorkstreamId,
          date: `${addDate}T00:00:00`,
          startTime: startAt.toISOString(),
          endTime: endAt.toISOString(),
          durationMinutes,
          isBillable: addMode === "firm" ? false : true,
          notes: addNotes.trim() || null,
          tags: []
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to add timer");
      }

      setOpenAdd(false);
      setAddClientId("");
      setAddWorkstreamId("");
      setAddDate("");
      setAddStartTime("");
      setAddEndTime("");
      setAddNotes("");
      router.push(`/${firmSlug}/dashboard`);
      router.refresh();
    } catch (submitError) {
      setAddError(submitError instanceof Error ? submitError.message : "Failed to add timer");
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <>
      <header className="cb-topbar">
        <div className="mx-auto flex w-full max-w-[1720px] items-center justify-between gap-6 px-4 py-3">
          <div className="flex items-center gap-10">
            <div>
              <p
                className="cb-display text-[3.1rem] leading-none tracking-[-0.03em] text-[#1c3a28]"
                style={{ fontFamily: "Baskerville, 'Times New Roman', serif", fontWeight: 600 }}
              >
                Tally<span className="text-[#c4531a]">.</span>
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => {
                const href = `/${firmSlug}/${item.href}`;
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={`${item.label}-${item.href}`}
                    href={href}
                    className={`rounded-xl px-3 py-2 text-base font-medium ${
                      active
                        ? "border border-[#24482f] bg-[#f7f4ef] text-[#1c3a28]"
                        : "text-[#4a4a42] hover:bg-[#ede9e1]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

          </div>

          <div className="ml-auto flex items-center gap-2">
            <button className="button-secondary h-11 gap-2 px-5 text-base" onClick={() => setOpenAdd(true)} type="button">
              + Add Timer
            </button>
            <button
              className="button-start h-11 gap-2 px-5 text-base"
              onClick={() => setOpenStart(true)}
              type="button"
            >
              <IconTimer />
              Start timer
            </button>
            <Link
              aria-label="Settings"
              className="button-secondary h-10 w-10 p-0 text-[#4a4a42]"
              href={`/${firmSlug}/settings`}
            >
              <IconCog />
            </Link>
            <UserMenu
              name={user.name}
              role={user.role}
              adminHref={user.isSuperAdmin ? "/admin" : undefined}
              settingsHref={`/${firmSlug}/settings`}
            />
          </div>
        </div>
      </header>

      {openStart && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(20,18,12,0.25)] p-6 pt-16">
          <div className="w-full max-w-4xl rounded-2xl border border-[#ddd9d0] bg-white shadow-[0_8px_32px_rgba(20,18,12,0.16)]">
            <div className="border-b border-[#ddd9d0] px-6 py-4">
              <h2 className="cb-display text-4xl text-[#1a2e1f]">Start timer</h2>
            </div>

            <form className="space-y-4 p-6" onSubmit={onStartTimer}>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#f7f4ef] p-1">
                <button
                  className={`rounded-md px-4 py-2 text-sm ${startMode === "client" ? "bg-white text-[#1a2e1f] shadow-sm" : "text-[#7a7a70]"}`}
                  onClick={() => {
                    setStartMode("client");
                    setStartClientId("");
                    setStartWorkstreamId("");
                  }}
                  type="button"
                >
                  Client work
                </button>
                <button
                  className={`rounded-md px-4 py-2 text-sm ${startMode === "firm" ? "bg-white text-[#1a2e1f] shadow-sm" : "text-[#7a7a70]"}`}
                  onClick={() => {
                    setStartMode("firm");
                    setStartClientId(firmClient?.id ?? "");
                    setStartWorkstreamId("");
                  }}
                  type="button"
                >
                  Firm work
                </button>
              </div>

              {startMode === "firm" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Work area</label>
                    <input className="input" disabled value={firmClient?.name ?? "Firm"} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Workstream</label>
                    <select
                      className="input"
                      disabled={!firmClient}
                      onChange={(event) => setStartWorkstreamId(event.target.value)}
                      value={startWorkstreamId}
                    >
                      <option value="">Select workstream</option>
                      {firmWorkstreamOptions.map((workstream) => (
                        <option key={workstream.id} value={workstream.id}>{workstream.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Client</label>
                    <select
                      className="input"
                      onChange={(event) => {
                        setStartClientId(event.target.value);
                        setStartWorkstreamId("");
                      }}
                      value={startClientId}
                    >
                      <option value="">Select client</option>
                      {clientWorkAreas.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Workstream</label>
                    <select
                      className="input"
                      disabled={!startClientId}
                      onChange={(event) => setStartWorkstreamId(event.target.value)}
                      value={startWorkstreamId}
                    >
                      <option value="">Select workstream</option>
                      {startWorkstreamOptions.map((workstream) => (
                        <option key={workstream.id} value={workstream.id}>{workstream.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1a2e1f]">Notes (optional)</label>
                <input className="input" onChange={(event) => setStartNotes(event.target.value)} placeholder="What are you working on?" value={startNotes} />
              </div>

              {startError ? <p className="text-sm text-red-600">{startError}</p> : null}

              <div className="flex justify-end gap-2">
                <button className="button-secondary" onClick={() => setOpenStart(false)} type="button">Cancel</button>
                <button className="button" disabled={startSaving} type="submit">
                  {startSaving ? "Starting..." : "Start timer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {openAdd && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(20,18,12,0.25)] p-6 pt-16">
          <div className="w-full max-w-4xl rounded-2xl border border-[#ddd9d0] bg-white shadow-[0_8px_32px_rgba(20,18,12,0.16)]">
            <div className="border-b border-[#ddd9d0] px-6 py-4">
              <h2 className="cb-display text-4xl text-[#1a2e1f]">Add timer</h2>
            </div>

            <form className="space-y-4 p-6" onSubmit={onAddTimer}>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#f7f4ef] p-1">
                <button
                  className={`rounded-md px-4 py-2 text-sm ${addMode === "client" ? "bg-white text-[#1a2e1f] shadow-sm" : "text-[#7a7a70]"}`}
                  onClick={() => {
                    setAddMode("client");
                    setAddClientId("");
                    setAddWorkstreamId("");
                  }}
                  type="button"
                >
                  Client work
                </button>
                <button
                  className={`rounded-md px-4 py-2 text-sm ${addMode === "firm" ? "bg-white text-[#1a2e1f] shadow-sm" : "text-[#7a7a70]"}`}
                  onClick={() => {
                    setAddMode("firm");
                    setAddClientId(firmClient?.id ?? "");
                    setAddWorkstreamId("");
                  }}
                  type="button"
                >
                  Firm work
                </button>
              </div>

              {addMode === "firm" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Work area</label>
                    <input className="input" disabled value={firmClient?.name ?? "Firm"} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Workstream</label>
                    <select
                      className="input"
                      disabled={!firmClient}
                      onChange={(event) => setAddWorkstreamId(event.target.value)}
                      value={addWorkstreamId}
                    >
                      <option value="">Select workstream</option>
                      {firmWorkstreamOptions.map((workstream) => (
                        <option key={workstream.id} value={workstream.id}>{workstream.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Date</label>
                    <input className="input" onChange={(event) => setAddDate(event.target.value)} type="date" value={addDate} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Start time</label>
                      <input className="input" onChange={(event) => setAddStartTime(event.target.value)} type="time" value={addStartTime} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">End time</label>
                      <input className="input" onChange={(event) => setAddEndTime(event.target.value)} type="time" value={addEndTime} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Client</label>
                    <select
                      className="input"
                      onChange={(event) => {
                        setAddClientId(event.target.value);
                        setAddWorkstreamId("");
                      }}
                      value={addClientId}
                    >
                      <option value="">Select client</option>
                      {clientWorkAreas.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Workstream</label>
                    <select
                      className="input"
                      disabled={!addClientId}
                      onChange={(event) => setAddWorkstreamId(event.target.value)}
                      value={addWorkstreamId}
                    >
                      <option value="">Select workstream</option>
                      {addWorkstreamOptions.map((workstream) => (
                        <option key={workstream.id} value={workstream.id}>{workstream.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Date</label>
                    <input className="input" onChange={(event) => setAddDate(event.target.value)} type="date" value={addDate} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Start time</label>
                      <input className="input" onChange={(event) => setAddStartTime(event.target.value)} type="time" value={addStartTime} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">End time</label>
                      <input className="input" onChange={(event) => setAddEndTime(event.target.value)} type="time" value={addEndTime} />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1a2e1f]">Notes (optional)</label>
                <input className="input" onChange={(event) => setAddNotes(event.target.value)} placeholder="What was worked on?" value={addNotes} />
              </div>

              {addError ? <p className="text-sm text-red-600">{addError}</p> : null}

              <div className="flex justify-end gap-2">
                <button className="button-secondary" onClick={() => setOpenAdd(false)} type="button">Cancel</button>
                <button className="button" disabled={addSaving} type="submit">
                  {addSaving ? "Saving..." : "Add timer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
