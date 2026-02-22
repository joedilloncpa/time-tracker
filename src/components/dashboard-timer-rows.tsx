"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  async function confirmDelete() {
    if (!deletingId) {
      return;
    }

    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(
        `/api/time-entries?firmSlug=${encodeURIComponent(firmSlug)}&id=${encodeURIComponent(deletingId)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to delete time entry");
      }

      setDeletingId(null);
      router.refresh();
    } catch (deleteErr) {
      setDeleteError(deleteErr instanceof Error ? deleteErr.message : "Failed to delete time entry");
    } finally {
      setDeleting(false);
    }
  }

  function cancelDelete() {
    setDeletingId(null);
    setDeleteError("");
  }

  const deleteModal = deletingId && mounted
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={cancelDelete}>
          <div
            className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-[0_8px_32px_rgba(20,18,12,0.16)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-[#1a2e1f]">Delete this time entry?</p>
            <p className="mt-1 text-xs text-[#7a7a70]">This action cannot be undone.</p>
            {deleteError ? <p className="mt-2 text-xs text-red-600">{deleteError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="button-secondary !h-8 !px-3 !text-sm"
                disabled={deleting}
                onClick={cancelDelete}
                type="button"
              >
                Cancel
              </button>
              <button
                className="!h-8 !px-3 !text-sm rounded-md bg-red-600 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
                onClick={confirmDelete}
                type="button"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <tbody>
        {rows.map((timer) => {
          const isEditing = timer.id === editingId && draft;
          if (isEditing) {
            return (
              <tr key={timer.id} className="border-b border-[#d6e6dc] [&>td]:bg-[#e6f1ea]">
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
                <td className="py-2"></td>
              </tr>
            );
          }

          return (
            <tr
              key={timer.id}
              className="cursor-pointer border-b border-[#ede9e1] [&>td]:transition-colors [&>td]:duration-100 [&:hover>td]:!bg-[#e6f1ea]"
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
              <td className="py-2 pr-3">{timer.notes || "-"}</td>
              <td className="py-2">
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#7a7a70] transition-colors hover:bg-red-50 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingId(timer.id);
                  }}
                  title="Delete entry"
                  type="button"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td className="pt-2 text-xs text-[#4a4a42]" colSpan={isAdmin ? 9 : 8}>
            Tip: double-click any timer row to edit inline.
          </td>
        </tr>
      </tfoot>
      {deleteModal}
    </>
  );
}
