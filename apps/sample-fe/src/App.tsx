import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { DocEditor, FetchBackend, type DocSummary } from '@talaatharb/doc-editor';

let unauthorizedHandler: () => void = () => {};
const backend = new FetchBackend({
  baseUrl: '',
  auth: {
    getAuthToken: async () => localStorage.getItem('doc-editor-token'),
    onUnauthorized: () => unauthorizedHandler(),
  },
});

function LoginForm({ onSignedIn }: { onSignedIn(): void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await backend.login(username.trim(), password);
      onSignedIn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={(event) => void submit(event)}>
        <h1>Sign in to Paperwork</h1>
        <p>Demo account: any username, password <code>demo</code>.</p>
        <label>Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="app-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    unauthorizedHandler = () => {
      backend.logout();
      setSignedIn(false);
    };
    void backend.hasToken().then(setSignedIn);
  }, []);

  if (signedIn === null) return null;
  if (!signedIn) return <LoginForm onSignedIn={() => setSignedIn(true)} />;
  return <Workspace onSignOut={() => { backend.logout(); setSignedIn(false); }} />;
}

function Workspace({ onSignOut }: { onSignOut(): void }) {
  const [documents, setDocuments] = useState<DocSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'template' | 'fill'>('template');
  const [mergeKeys, setMergeKeys] = useState<string[]>([]);
  const [mergeValues, setMergeValues] = useState<Record<string, string>>({});
  // Only keys filled in are substituted; the rest render as [[key]] markers in the preview.
  const filledData = useMemo(
    () => Object.fromEntries(Object.entries(mergeValues).filter(([, value]) => value !== '')),
    [mergeValues],
  );
  const selectedIdRef = useRef<string | null>(null);

  const refresh = useCallback(async (preferredId?: string) => {
    setError(null);
    try {
      const next = await backend.list();
      setDocuments(next);
      if (preferredId && next.some((item) => item.id === preferredId)) {
        selectedIdRef.current = preferredId;
        setSelectedId(preferredId);
      } else if (!next.some((item) => item.id === selectedIdRef.current)) {
        selectedIdRef.current = next[0]?.id ?? null;
        setSelectedId(next[0]?.id ?? null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => documents.find((item) => item.id === selectedId) ?? null,
    [documents, selectedId],
  );
  const updateSelectedTitle = useCallback((nextTitle: string) => {
    if (!selectedId) return;
    setDocuments((current) =>
      current.map((item) => item.id === selectedId ? { ...item, title: nextTitle } : item),
    );
  }, [selectedId]);

  async function createDocument() {
    setError(null);
    try {
      const created = await backend.create({ title: 'Untitled document' });
      await refresh(created.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create document.');
    }
  }

  async function deleteDocument(id: string) {
    if (!window.confirm('Delete this document permanently?')) return;
    setError(null);
    try {
      await backend.remove(id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete document.');
    }
  }

  return (
    <main className="app-frame">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Doc Editor home">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>Paperwork</span>
        </a>
        <div className="topbar-right">
          <span className="connection-status"><span aria-hidden="true" /> Connected</span>
          <button className="primary-button" type="button" onClick={() => void createDocument()}>
            <span aria-hidden="true">＋</span> New document
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar" aria-label="Documents">
          <div className="sidebar-heading">
            <div>
              <p className="eyebrow">WORKSPACE</p>
              <h1>Documents</h1>
            </div>
            <span className="document-count">{documents.length}</span>
          </div>
          <button className="sidebar-create" type="button" onClick={() => void createDocument()}>
            <span aria-hidden="true">＋</span> Create a document
          </button>
          <div className="document-list" aria-label="Your documents">
            {loading && <p className="sidebar-empty">Loading documents…</p>}
            {!loading && documents.length === 0 && <p className="sidebar-empty">Your documents will appear here.</p>}
            {documents.map((item) => (
              <div key={item.id} className={`document-row${selectedId === item.id ? ' selected' : ''}`}>
                <button type="button" className="document-select" onClick={() => { selectedIdRef.current = item.id; setSelectedId(item.id); }}>
                  <span className="document-icon" aria-hidden="true">▤</span>
                  <span className="document-copy">
                    <span className="document-title">{item.title}</span>
                    <span className="document-date">{formatDate(item.updatedAt)}</span>
                  </span>
                </button>
                <button
                  className="delete-button"
                  type="button"
                  aria-label={`Delete ${item.title}`}
                  title={`Delete ${item.title}`}
                  onClick={() => void deleteDocument(item.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <span className="avatar" aria-hidden="true">M</span>
            <span><strong>My workspace</strong><small>Local demo account</small></span>
            <button type="button" className="signout" onClick={onSignOut}>Sign out</button>
          </div>
        </aside>
        <section className="editor-area" aria-label="Editing workspace">
          {error && (
            <div className="app-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void refresh()}>Retry</button>
            </div>
          )}
          {selected ? (
            <>
              <div className="document-heading">
                <div className="breadcrumb"><span>Documents</span><span aria-hidden="true">/</span><span>{selected.title}</span></div>
                <div className="view-switch" role="group" aria-label="View">
                  <button type="button" aria-pressed={view === 'template'} onClick={() => setView('template')}>Template</button>
                  <button type="button" aria-pressed={view === 'fill'} onClick={() => setView('fill')}>Fill &amp; Print</button>
                </div>
              </div>
              {view === 'fill' && (
                <form className="fill-form" aria-label="Merge data" onSubmit={(event) => event.preventDefault()}>
                  {mergeKeys.length === 0 && <p>This template has no merge fields. Add some in Template view.</p>}
                  {mergeKeys.map((key) => (
                    <label key={key}>
                      <span>{key}</span>
                      <input
                        value={mergeValues[key] ?? ''}
                        onChange={(event) => setMergeValues((current) => ({ ...current, [key]: event.target.value }))}
                      />
                    </label>
                  ))}
                </form>
              )}
              <DocEditor
                key={selected.id}
                backend={backend}
                documentId={selected.id}
                onTitleChange={updateSelectedTitle}
                mode={view === 'fill' ? 'preview' : 'template'}
                mergeData={filledData}
                onMergeKeysChange={setMergeKeys}
                autoPagination
              />
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">▤</div>
              <h2>{loading ? 'Connecting to your workspace…' : 'A blank page is a beginning.'}</h2>
              <p>{loading ? 'Loading your documents' : 'Create a document and start putting your thoughts into words.'}</p>
              {!loading && <button className="primary-button" type="button" onClick={() => void createDocument()}>Create your first document</button>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
