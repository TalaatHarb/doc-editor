import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { CSSProperties, Ref } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { buildExtensions } from '../extensions';
import { mergeHighlightKey } from '../extensions/merge-field';
import { applyMergeData, extractMergeKeys, type MergeFallback } from '../merge/merge-fields';
import {
  DEFAULT_DOC_META,
  type DocContent,
  type DocMeta,
  type DocVersionSummary,
  type DocumentBackend,
} from '../types';
import { readImageFile } from '../utils/images';
import { downloadBlob, exportDocument, parseImport, type ExportFormat } from '../utils/io';
import { FindReplaceBar, MergePanel, VersionsPanel } from './panels';
import { Toolbar } from './toolbar';

type SaveState = 'loading' | 'saved' | 'saving' | 'error';
type Panel = 'merge' | 'history' | null;
type SetContentArg = Parameters<Editor['commands']['setContent']>[0];

export interface DocEditorHandle {
  editor: Editor | null;
}

export interface DocEditorProps {
  backend: DocumentBackend;
  documentId: string;
  onTitleChange?(title: string): void;
  /** `template` edits the document; `preview` shows it with `mergeData` applied (read-only, never saved). */
  mode?: 'template' | 'preview';
  mergeData?: Record<string, string>;
  mergeFallback?: MergeFallback;
  /** Called whenever the set of merge keys used in the template changes. */
  onMergeKeysChange?(keys: string[]): void;
  editorRef?: Ref<DocEditorHandle>;
}

const PAPER_SIZE: Record<DocMeta['pageSize'], [number, number]> = {
  A4: [210, 297],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
  A5: [148, 210],
};

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];

export function DocEditor({
  backend,
  documentId,
  onTitleChange,
  mode = 'template',
  mergeData,
  mergeFallback = 'marker',
  onMergeKeysChange,
  editorRef,
}: DocEditorProps) {
  const [document, setDocument] = useState<DocContent | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [panel, setPanel] = useState<Panel>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [highlightMerge, setHighlightMerge] = useState(true);
  const [mergeKeys, setMergeKeys] = useState<string[]>([]);
  const [versions, setVersions] = useState<DocVersionSummary[] | null>(null);
  const [currentVersion, setCurrentVersion] = useState(0);
  const versionRef = useRef(0);
  const metaRef = useRef<DocMeta>(DEFAULT_DOC_META);
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const templateRef = useRef<unknown>(null);
  const editorInstance = useRef<Editor | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const previewing = mode === 'preview';
  const previewingRef = useRef(previewing);
  const wasPreviewingRef = useRef(previewing);
  const mergeDataRef = useRef(mergeData);
  const mergeFallbackRef = useRef(mergeFallback);
  const onTitleChangeRef = useRef(onTitleChange);
  const onMergeKeysRef = useRef(onMergeKeysChange);

  useEffect(() => {
    onTitleChangeRef.current = onTitleChange;
    onMergeKeysRef.current = onMergeKeysChange;
    mergeDataRef.current = mergeData;
    mergeFallbackRef.current = mergeFallback;
  }, [onTitleChange, onMergeKeysChange, mergeData, mergeFallback]);

  const extensions = useMemo(() => buildExtensions({ highlightMergeFields: true }), []);

  const publishKeys = useCallback((content: unknown) => {
    const keys = extractMergeKeys(content);
    setMergeKeys((previous) => (previous.join('\u0000') === keys.join('\u0000') ? previous : keys));
    onMergeKeysRef.current?.(keys);
  }, []);

  const flushSave = useCallback(
    (currentEditor: Editor) => {
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        if (!loadedRef.current) return;
        setSaveState('saving');
        setError(null);
        try {
          const result = await backend.save(documentId, {
            content: currentEditor.getJSON(),
            meta: metaRef.current,
            baseVersion: versionRef.current,
          });
          versionRef.current = result.version;
          setCurrentVersion(result.version);
          setSaveState('saved');
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Unable to save this document.');
          setSaveState('error');
        }
      });
    },
    [backend, documentId],
  );

  const scheduleSave = useCallback(
    (currentEditor: Editor) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSaveState('saving');
      timerRef.current = setTimeout(() => flushSave(currentEditor), 700);
    },
    [flushSave],
  );

  // Inserts pasted/dropped image files; returns true when it handled the event.
  const handleImageFiles = useCallback((files: FileList | null | undefined) => {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return false;
    void (async () => {
      for (const file of images) {
        const src = await readImageFile(file);
        if (src) editorInstance.current?.chain().focus().setImage({ src, alt: file.name }).run();
      }
    })();
    return true;
  }, []);

  const editor = useEditor(
    {
      extensions,
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      editable: false,
      shouldRerenderOnTransaction: true,
      editorProps: {
        handlePaste: (_view, event) => handleImageFiles(event.clipboardData?.files),
        handleDrop: (_view, event) => handleImageFiles((event as DragEvent).dataTransfer?.files),
      },
      onUpdate: ({ editor: currentEditor }) => {
        if (previewingRef.current) return;
        publishKeys(currentEditor.getJSON());
        scheduleSave(currentEditor);
      },
    },
    [documentId],
  );

  useEffect(() => {
    editorInstance.current = editor;
  }, [editor]);
  useImperativeHandle(editorRef, () => ({ editor }), [editor]);

  const meta = document?.meta ?? DEFAULT_DOC_META;
  const [paperWidth, paperHeight] = useMemo(() => {
    const [width, height] = PAPER_SIZE[meta.pageSize];
    return meta.orientation === 'portrait' ? [width, height] : [height, width];
  }, [meta.pageSize, meta.orientation]);

  const pageStyle = {
    '--page-width': `${paperWidth}mm`,
    '--page-height': `${paperHeight}mm`,
    '--page-margin-top': `${meta.margins.top}mm`,
    '--page-margin-right': `${meta.margins.right}mm`,
    '--page-margin-bottom': `${meta.margins.bottom}mm`,
    '--page-margin-left': `${meta.margins.left}mm`,
    zoom: zoom / 100,
  } as CSSProperties;

  const loadDocument = useCallback(async () => {
    loadedRef.current = false;
    setSaveState('loading');
    setError(null);
    try {
      const loaded = await backend.load(documentId);
      versionRef.current = loaded.version;
      setCurrentVersion(loaded.version);
      metaRef.current = loaded.meta;
      setDocument(loaded);
      onTitleChangeRef.current?.(loaded.meta.title);
      publishKeys(loaded.content);
      templateRef.current = loaded.content;
      const shown = previewingRef.current
        ? applyMergeData(loaded.content, mergeDataRef.current ?? {}, mergeFallbackRef.current)
        : loaded.content;
      editor?.commands.setContent(shown as SetContentArg);
      editor?.setEditable(!previewingRef.current);
      wasPreviewingRef.current = previewingRef.current;
      loadedRef.current = true;
      setSaveState('saved');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load this document.');
      setSaveState('error');
    }
  }, [backend, documentId, editor, publishKeys]);

  useEffect(() => {
    if (!editor) return;
    void loadDocument();
    return () => {
      loadedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, loadDocument]);

  // Switch between the editable template and the merged, read-only preview.
  useEffect(() => {
    previewingRef.current = previewing;
    if (!editor || !loadedRef.current) return;
    if (previewing) {
      if (!wasPreviewingRef.current) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
          flushSave(editor);
        }
        templateRef.current = editor.getJSON();
        editor.setEditable(false);
        setFindOpen(false);
      }
      editor.commands.setContent(
        applyMergeData(templateRef.current, mergeData ?? {}, mergeFallback) as SetContentArg,
      );
    } else if (wasPreviewingRef.current) {
      editor.commands.setContent(templateRef.current as SetContentArg);
      editor.setEditable(true);
    }
    wasPreviewingRef.current = previewing;
  }, [previewing, mergeData, mergeFallback, editor, flushSave, saveState]);

  useEffect(() => {
    if (!editor) return;
    (editor.storage as unknown as { mergeField: { highlight: boolean } }).mergeField.highlight = highlightMerge;
    editor.view.dispatch(editor.state.tr.setMeta(mergeHighlightKey, highlightMerge));
  }, [editor, highlightMerge]);

  const refreshVersions = useCallback(async () => {
    if (!backend.listVersions) return;
    setVersions(null);
    try {
      setVersions(await backend.listVersions(documentId));
    } catch (caught) {
      setVersions([]);
      setError(caught instanceof Error ? caught.message : 'Unable to load version history.');
    }
  }, [backend, documentId]);

  useEffect(() => {
    if (panel === 'history') void refreshVersions();
  }, [panel, refreshVersions, currentVersion]);

  async function restore(version: number) {
    if (!backend.restoreVersion) return;
    try {
      if (timerRef.current) clearTimeout(timerRef.current);
      await saveQueueRef.current;
      await backend.restoreVersion(documentId, version);
      await loadDocument();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to restore this version.');
    }
  }

  function updateMeta(patch: Partial<DocMeta>) {
    const nextMeta = { ...metaRef.current, ...patch };
    metaRef.current = nextMeta;
    setDocument((current) => (current ? { ...current, meta: nextMeta } : current));
    if (editor && !previewing) scheduleSave(editor);
  }

  async function importFile(file: File | undefined) {
    if (importInput.current) importInput.current.value = '';
    if (!file || !editor) return;
    if (!window.confirm(`Replace the current content with "${file.name}"?`)) return;
    try {
      editor.commands.setContent(parseImport(file.name, await file.text()) as SetContentArg, { emitUpdate: true });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to import this file.');
    }
  }

  function goToPage(page: number) {
    if (!editor) return;
    let target = 1;
    let seen = 0;
    if (page > 1) {
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'pageBreak' && ++seen === page - 1) target = pos + node.nodeSize;
      });
    }
    const position = Math.min(target, editor.state.doc.content.size);
    editor.chain().focus().setTextSelection(position).scrollIntoView().run();
  }

  if (!editor || saveState === 'loading' || !document) {
    return (
      <div className="editor-message" role="status">
        {error ? (
          <>
            <p>{error}</p>
            <button type="button" onClick={() => void loadDocument()}>Retry</button>
          </>
        ) : (
          'Loading document…'
        )}
      </div>
    );
  }

  let pageCount = 1;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'pageBreak') pageCount += 1;
  });
  const words = editor.storage.characterCount.words() as number;
  const characters = editor.storage.characterCount.characters() as number;

  return (
    <section
      className="editor-shell"
      aria-label="Document editor"
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !previewing) {
          event.preventDefault();
          setFindOpen(true);
        }
      }}
    >
      <style>{`@media print { @page { size: ${paperWidth}mm ${paperHeight}mm; margin: 0; } }`}</style>
      <label className="document-title-field">
        <span className="visually-hidden">Document title</span>
        <input
          aria-label="Document title"
          value={meta.title}
          readOnly={previewing}
          onChange={(event) => {
            updateMeta({ title: event.target.value });
            onTitleChange?.(event.target.value);
          }}
        />
      </label>
      {!previewing && <Toolbar editor={editor} onFind={() => setFindOpen(true)} onPrint={() => window.print()} />}
      {findOpen && !previewing && <FindReplaceBar editor={editor} onClose={() => setFindOpen(false)} />}
      {error && (
        <div className="editor-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadDocument()}>Reload document</button>
        </div>
      )}
      <div className="editor-body">
        <div className="paper-stage">
          <div className="paper-page" style={pageStyle}>
            <EditorContent editor={editor} />
          </div>
        </div>
        {panel === 'merge' && (
          <MergePanel
            keys={mergeKeys}
            highlight={highlightMerge}
            onHighlightChange={setHighlightMerge}
            disabled={previewing}
            onInsert={(key) => editor.chain().focus().insertMergeField({ key }).run()}
          />
        )}
        {panel === 'history' && backend.listVersions && (
          <VersionsPanel
            versions={versions}
            currentVersion={currentVersion}
            loading={versions === null}
            onRestore={(version) => void restore(version)}
          />
        )}
      </div>
      <div className="status-bar">
        <span className={`save-indicator save-${saveState}`} role="status" aria-live="polite">
          {previewing ? 'Preview' : saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save failed'}
        </span>
        <span>{words} words · {characters} characters</span>
        <label>
          Page{' '}
          <select aria-label="Go to page" value="" onChange={(event) => event.target.value && goToPage(Number(event.target.value))}>
            <option value="">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</option>
            {Array.from({ length: pageCount }, (_, index) => (
              <option key={index} value={index + 1}>Go to {index + 1}</option>
            ))}
          </select>
        </label>
        <details className="page-setup">
          <summary>Page setup</summary>
          <div className="page-setup-body">
            <label>Size
              <select aria-label="Page size" disabled={previewing} value={meta.pageSize} onChange={(event) => updateMeta({ pageSize: event.target.value as DocMeta['pageSize'] })}>
                {Object.keys(PAPER_SIZE).map((size) => <option key={size}>{size}</option>)}
              </select>
            </label>
            <label>Orientation
              <select aria-label="Orientation" disabled={previewing} value={meta.orientation} onChange={(event) => updateMeta({ orientation: event.target.value as DocMeta['orientation'] })}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <label key={side}>Margin {side} (mm)
                <input
                  type="number"
                  min={0}
                  max={60}
                  disabled={previewing}
                  aria-label={`Margin ${side}`}
                  value={meta.margins[side]}
                  onChange={(event) => {
                    const value = Math.min(60, Math.max(0, Number(event.target.value) || 0));
                    updateMeta({ margins: { ...metaRef.current.margins, [side]: value } });
                  }}
                />
              </label>
            ))}
          </div>
        </details>
        <label>
          Zoom{' '}
          <select aria-label="Zoom" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
            {ZOOM_LEVELS.map((level) => <option key={level} value={level}>{level}%</option>)}
          </select>
        </label>
        <button type="button" aria-pressed={panel === 'merge'} onClick={() => setPanel(panel === 'merge' ? null : 'merge')}>
          Merge fields ({mergeKeys.length})
        </button>
        {backend.listVersions && (
          <button type="button" aria-pressed={panel === 'history'} onClick={() => setPanel(panel === 'history' ? null : 'history')}>
            History
          </button>
        )}
        {previewing && <button type="button" onClick={() => window.print()}>Print</button>}
        {!previewing && (
          <>
            <label className="status-file">
              <select
                aria-label="Export"
                value=""
                onChange={(event) => {
                  const { blob, filename } = exportDocument(editor, meta.title, event.target.value as ExportFormat);
                  downloadBlob(blob, filename);
                }}
              >
                <option value="">Export…</option>
                <option value="html">HTML</option>
                <option value="txt">Text</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <button type="button" onClick={() => importInput.current?.click()}>Import</button>
            <input
              ref={importInput}
              className="visually-hidden"
              type="file"
              accept=".html,.htm,.txt,.json"
              tabIndex={-1}
              aria-label="Import file"
              onChange={(event) => void importFile(event.target.files?.[0])}
            />
          </>
        )}
      </div>
    </section>
  );
}
