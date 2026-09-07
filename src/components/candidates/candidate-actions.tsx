import { useEffect, useState } from 'react';
import { api, type CandidateNote } from '#/lib/api';
import { cn } from '#/lib/utils';

const STATUSES = ['new', 'shortlisted', 'interview', 'rejected', 'hired'];

export function CandidateActions({
  slug,
  initialNote,
  className,
}: {
  slug: string;
  initialNote: CandidateNote;
  className?: string;
}) {
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setNote(initialNote);
  }, [initialNote]);

  async function save(updates: Partial<CandidateNote>) {
    setSaving(true);
    setMessage('');
    try {
      const updated = await api.updateNote(slug, updates);
      setNote(updated);
      setMessage('Saved');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      <h3 className="text-lg font-semibold">Pipeline status</h3>
      <label className="mt-4 block text-sm font-medium text-zinc-500">
        Status
      </label>
      <select
        value={note.status}
        onChange={(e) => save({ status: e.target.value })}
        disabled={saving}
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => save({ starred: !note.starred })}
        disabled={saving}
        className="mt-3 w-full rounded-lg border border-amber-300 px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-950/30"
      >
        {note.starred ? '★ Starred — click to unstar' : '☆ Star candidate'}
      </button>

      <label className="mt-4 block text-sm font-medium">Recruiter notes</label>
      <textarea
        value={note.notes}
        onChange={(e) => setNote({ ...note, notes: e.target.value })}
        rows={4}
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        placeholder="Interview notes, concerns, next steps…"
      />
      <button
        type="button"
        onClick={() => save({ notes: note.notes })}
        disabled={saving}
        className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save notes'}
      </button>
      {message && <p className="mt-2 text-xs text-zinc-500">{message}</p>}
    </div>
  );
}
