'use client';

import {type KeyboardEvent, useId, useState} from 'react';

import {cn} from '@/lib/utils/cn';

/**
 * A chip-style input for a list of short strings (categories, tags, tech).
 *
 * Enter and comma both commit the current token, Backspace on an empty field
 * removes the last one, and duplicates are rejected silently. Existing values
 * are offered through a native `<datalist>` rather than a bespoke dropdown:
 * the browser already handles filtering, keyboard navigation and screen-reader
 * announcements correctly, and none of that is worth reimplementing here.
 */
export function TokenInput({
  label,
  values,
  onChange,
  suggestions = [],
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const inputId = useId();

  /** Adds the pending token if it is non-empty and not already present. */
  const commit = (raw: string) => {
    const token = raw.trim().replace(/,+$/, '');
    if (token.length === 0 || values.includes(token)) {
      setDraft('');
      return;
    }
    onChange([...values, token]);
    setDraft('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(draft);
      return;
    }

    if (event.key === 'Backspace' && draft.length === 0 && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-[var(--color-ink-muted)]"
      >
        {label}
      </label>

      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-2',
          'border-[var(--color-border)] bg-[var(--color-surface)]',
          'focus-within:border-[var(--color-sakura)]',
        )}
      >
        {values.map((value) => (
          <span key={value} className="chip">
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={`Remove ${value}`}
              className="ml-0.5 opacity-60 transition hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}

        <input
          id={inputId}
          list={listId}
          value={draft}
          placeholder={values.length === 0 ? placeholder : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          // Committing on blur means a value typed but not confirmed is not
          // silently lost when the author clicks Save.
          onBlur={() => commit(draft)}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
        />

        <datalist id={listId}>
          {suggestions
            .filter((suggestion) => !values.includes(suggestion))
            .map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
        </datalist>
      </div>
    </div>
  );
}
