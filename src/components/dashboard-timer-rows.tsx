"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TimerRow = {
  id: string;
  dateIso: string;
  startTimeIso: string | null;
  endTimeIso: string | null;
  durationMinutes: number;
  isBillable: boolean;
  notes: string | null;
  workstreamId: string;
  workstreamName: string;
  userName?: string;
};

type WorkstreamOption = {
  id: string;
  name: string;
};

type DraftRow = {
  date: string;
  workstreamId: string;
  startTime: string;
  endTime: string;
  hours: string;
  isBillable: boolean;
  notes: string;
};

function formatDateText(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeText(iso: string | null) {
  if (!iso) {
    return "-";
  }
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function toDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function toTimeInput(iso: string | null) {
  if (!iso) {
    return "";
  }
  return new Date(iso).toISOString().slice(11, 16);
}

function toIsoOrNull(date: string, time: string) {
  if (!time) {
    return null;
  }
  return new Date(`${date}T${time}:00`).toISOString();
}

export function DashboardTimerRows({
  firmSlug,
  isAdmin,
  rows,
  workstreams
}: {
  firmSlug: string;
  isAdmin: boolean;
  rows: TimerRow[];
  workstreams: WorkstreamOption[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function beginEdit(row: TimerRow) {
    setEditingId(row.id);
    setDraft({
      date: toDateInput(row.dateIso),
      workstreamId: row.workstreamId,
      startTime: toTimeInput(row.startTimeIso),
      endTime: toTimeInput(row.endTimeIso),
      hours: (row.durationMinutes / 60).toFixed(2),
      isBillable: row.isBillable,
      notes: row.notes ?? ""
    });
    setError("");
  }

  async function saveEdit() {
    if (!editingId || !draft) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const durationMinutes = Math.max(1, Math.round(Number(draft.hours || "0") * 60));
      if (Number.isNaN(durationMinutes)) {
        throw new Error("Hours must be a valid number");
      }

      const response = await fetch(`/api/time-entries?firmSlug=${firmSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds: [editingId],
          patch: {
            date: new Date(`${draft.date}T00:00:00`).toISOString(),
            workstreamId: draft.workstreamId,
            startTime: toIsoOrNull(draft.date, draft.startTime),
            endTime: toIsoOrNull(draft.date, draft.endTime),
            durationMinutes,
            isBillable: draft.isBillable,
            notes: draft.notes.trim() || null
          }
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to save timer row");
      }

      setEditingId(null);
      setDraft(null);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save timer row");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setError("");
  }

  return (
    <>
      <tbody>
        {rows.map((timer) => {
          const isEditing = timer.id === editingId && draft;
          if (isEditing) {
            return (
              <tr key={timer.id} className="border-b border-[#ddd9d0] bg-[rgba(28,58,40,0.05)]">
                <td className="py-2 pr-3">
                  <input
                    className="input !h-9 !w-[170px] !py-1.5"
                    onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                    type="date"
                    value={draft.date}
                  />
                </td>
                {isAdmin ? <td className="py-2 pr-3">{timer.userName}</td> : null}
                <td className="py-2 pr-3">
                  <select
                    className="input !h-9 !w-[220px] !py-1.5"
                    onChange={(event) => setDraft({ ...draft, workstreamId: event.target.value })}
                    value={draft.workstreamId}
                  >
                    {workstreams.map((workstream) => (
                      <option key={`${timer.id}-${workstream.id}`} value={workstream.id}>
                        {workstream.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <input
                    className="input !h-9 !w-[130px] !py-1.5"
                    onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
                    type="time"
                    value={draft.startTime}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    className="input !h-9 !w-[130px] !py-1.5"
                    onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
                    type="time"
                    value={draft.endTime}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    className="input !h-9 !w-[100px] !py-1.5"
                    onChange={(event) => setDraft({ ...draft, hours: event.target.value })}
                    step="0.01"
                    type="number"
                    value={draft.hours}
                  />
                </td>
                <td className="py-2 pr-3">
                  <select
                    className="input !h-9 !w-[130px] !py-1.5"
                    onChange={(event) => setDraft({ ...draft, isBillable: event.target.value === "client" })}
                    value={draft.isBillable ? "client" : "firm"}
                  >
                    <option value="client">Client Work</option>
                    <option value="firm">Firm Work</option>
                  </select>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="input !h-9 !min-w-[180px] !py-1.5"
                      onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                      placeholder="Notes"
                      value={draft.notes}
                    />
                    <button className="button-secondary !h-9 px-3" disabled={saving} onClick={cancelEdit} type="button">
                      Cancel
                    </button>
                    <button className="button !h-9 px-3" disabled={saving} onClick={saveEdit} type="button">
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                  {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
                </td>
              </tr>
            );
          }

          return (
            <tr
              key={timer.id}
              className="cursor-pointer border-b border-[#ede9e1] [&>td]:transition-colors [&>td]:duration-100 [&:hover>td]:!bg-[#e8ddff]"
              onDoubleClick={() => beginEdit(timer)}
              title="Double-click to edit"
            >
              <td className="py-2 pr-3">{formatDateText(timer.dateIso)}</td>
              {isAdmin ? <td className="py-2 pr-3">{timer.userName}</td> : null}
              <td className="py-2 pr-3">{timer.workstreamName}</td>
              <td className="py-2 pr-3">{formatTimeText(timer.startTimeIso)}</td>
              <td className="py-2 pr-3">{formatTimeText(timer.endTimeIso)}</td>
              <td className="py-2 pr-3">{(timer.durationMinutes / 60).toFixed(2)}</td>
              <td className="py-2 pr-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    timer.isBillable
                      ? "bg-[rgba(196,83,26,0.12)] text-[#c4531a]"
                      : "bg-[rgba(28,58,40,0.12)] text-[#1c3a28]"
                  }`}
                >
                  {timer.isBillable ? "Client Work" : "Firm Work"}
                </span>
              </td>
              <td className="py-2">{timer.notes || "-"}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td className="pt-2 text-xs text-[#4a4a42]" colSpan={isAdmin ? 8 : 7}>
            Tip: double-click any timer row to edit inline.
          </td>
        </tr>
      </tfoot>
    </>
  );
}
