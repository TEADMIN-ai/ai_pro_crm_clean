"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type Props = {
  dealId: string;
};

type DealNote = {
  id: string;
  note: string;
  createdBy?: string;
  role?: string;
  createdAt?: number;
};

function formatDate(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Just now";
  }

  return new Date(value).toLocaleString();
}

export default function DealNotes({ dealId }: Props) {
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<DealNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    if (!dealId) return;

    try {
      setError(null);
      const response = await authFetch(API_ROUTES.DEAL_NOTES(dealId), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as { notes?: DealNote[]; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? `Failed to load notes (${response.status})`);
      }

      setNotes(Array.isArray(payload?.notes) ? payload.notes : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load notes.");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedNote = note.trim();

    if (!trimmedNote || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await authFetch(API_ROUTES.DEAL_NOTES(dealId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note: trimmedNote }),
      });
      const payload = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;

      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error ?? `Failed to save note (${response.status})`);
      }

      setNote("");
      await loadNotes();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Staff Action Notes</h2>
        <p className="text-sm text-slate-500">
          Add operational notes after review and sign-off. Notes are stored with an audit entry.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Enter staff action note"
          className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          disabled={saving}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || note.trim().length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add Note"}
          </button>
          {error ? <span className="text-sm font-medium text-red-600">{error}</span> : null}
        </div>
      </form>

      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading notes...</p>
        ) : notes.length > 0 ? (
          notes.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm text-slate-900">{item.note}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">
                {item.role ?? "staff"} - {formatDate(item.createdAt)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No staff action notes yet.</p>
        )}
      </div>
    </section>
  );
}
