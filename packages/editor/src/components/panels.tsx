import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { getSearchState } from '../extensions/search';
import type { DocVersionSummary } from '../types';

export function FindReplaceBar({ editor, onClose }: { editor: Editor; onClose(): void }) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [regex, setRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const state = getSearchState(editor);

  useEffect(() => {
    editor.commands.setSearch({ query, regex, matchCase });
  }, [editor, query, regex, matchCase]);

  useEffect(() => () => void editor.commands.clearSearch(), [editor]);

  const invalidRegex =
    regex &&
    query !== '' &&
    state.matches.length === 0 &&
    (() => {
      try {
        new RegExp(query);
        return false;
      } catch {
        return true;
      }
    })();

  return (
    <div
      className="find-bar"
      role="search"
      aria-label="Find and replace"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'Enter' && (event.target as HTMLElement).dataset.role === 'query') {
          event.preventDefault();
          editor.commands.findNext(event.shiftKey ? -1 : 1);
        }
      }}
    >
      <input
        data-role="query"
        autoFocus
        aria-label="Find"
        placeholder="Find"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <input
        aria-label="Replace with"
        placeholder="Replace with"
        value={replacement}
        onChange={(event) => setReplacement(event.target.value)}
      />
      <span className="find-count" role="status" aria-live="polite">
        {invalidRegex
          ? 'Invalid pattern'
          : query
            ? `${state.matches.length ? state.current + 1 : 0} of ${state.matches.length}`
            : ''}
      </span>
      <button
        type="button"
        aria-label="Previous match"
        onClick={() => editor.commands.findNext(-1)}
      >
        ↑
      </button>
      <button type="button" aria-label="Next match" onClick={() => editor.commands.findNext(1)}>
        ↓
      </button>
      <button type="button" onClick={() => editor.commands.replaceCurrent(replacement)}>
        Replace
      </button>
      <button type="button" onClick={() => editor.commands.replaceAll(replacement)}>
        Replace all
      </button>
      <label>
        <input
          type="checkbox"
          checked={matchCase}
          onChange={(event) => setMatchCase(event.target.checked)}
        />{' '}
        Match case
      </label>
      <label>
        <input
          type="checkbox"
          checked={regex}
          onChange={(event) => setRegex(event.target.checked)}
        />{' '}
        Regex
      </label>
      <button type="button" aria-label="Close find and replace" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

export function MergePanel({
  keys,
  highlight,
  onHighlightChange,
  onInsert,
  disabled,
}: {
  keys: string[];
  highlight: boolean;
  onHighlightChange(value: boolean): void;
  onInsert(key: string): void;
  disabled: boolean;
}) {
  return (
    <aside className="side-panel" aria-label="Merge fields">
      <h2>Merge fields</h2>
      <label className="panel-toggle">
        <input
          type="checkbox"
          checked={highlight}
          onChange={(event) => onHighlightChange(event.target.checked)}
        />{' '}
        Highlight fields
      </label>
      {keys.length === 0 ? (
        <p className="panel-empty">
          No merge fields yet. Use “{'{{ }}'}” in the toolbar or Ctrl+Shift+M.
        </p>
      ) : (
        <ul>
          {keys.map((key) => (
            <li key={key}>
              <code>{key}</code>
              <button type="button" disabled={disabled} onClick={() => onInsert(key)}>
                Insert
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function VersionsPanel({
  versions,
  currentVersion,
  loading,
  onRestore,
}: {
  versions: DocVersionSummary[] | null;
  currentVersion: number;
  loading: boolean;
  onRestore(version: number): void;
}) {
  return (
    <aside className="side-panel" aria-label="Version history">
      <h2>Version history</h2>
      {loading || !versions ? (
        <p className="panel-empty">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="panel-empty">No saved versions yet.</p>
      ) : (
        <ul>
          {[...versions]
            .sort((a, b) => b.version - a.version)
            .map((entry) => (
              <li key={entry.version}>
                <span>
                  v{entry.version}
                  <small>{new Date(entry.savedAt).toLocaleString()}</small>
                </span>
                {entry.version === currentVersion ? (
                  <em>Current</em>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Restore version ${entry.version}? Your current content becomes a new version.`,
                        )
                      )
                        onRestore(entry.version);
                    }}
                  >
                    Restore
                  </button>
                )}
              </li>
            ))}
        </ul>
      )}
    </aside>
  );
}
