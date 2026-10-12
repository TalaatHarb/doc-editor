

# Product Plan — Browser-Based Word-Like Editor

A FE React library (supporting pluggable BE) + sample BE + sample FE application

## 1. Technology Choices

### 1.1 Editor core: **Tiptap 3** (recommended)

Reasons: "store the document as JSON instead of HTML" is the *default* behavior rather than something you engineer. V3 also adds server-side rendering of documents (useful later for server-side PDF/preview generation) and a Decorations API (handy for highlighting merge-field values without mutating content).

### 1.2 Storage format: **ProseMirror JSON** (no DOMPurify needed)

- The persisted document is the ProseMirror doc tree (`{type:"doc", content:[...]}`) — pure data, no HTML anywhere in the save/load path.
- **DOMPurify is therefore not required for the core loop.** You'd only need it in two edge cases: (a) importing foreign HTML (e.g., pasted rich content from another app — Tiptap parses pastes through its own schema, which already drops disallowed tags), (b) an optional "export to HTML" feature. Add `dompurify` as a small guard around those two paths only.
- Version the schema: store a `schemaVersion` in the document meta so future extensions can migrate old docs (Tiptap 3 has content-migration hooks for exactly this).

### 1.3 Monorepo layout

```
pnpm workspaces + Turborepo
├── packages/
│   └── editor/            # the React library (your product)
│       ├── src/
│       │   ├── components/   <DocEditor>, <Toolbar>, <PageCanvas>…
│       │   ├── extensions/   PageBreak, MergeField, PageSize, Table, …
│       │   ├── backend/      types + default fetch-based backend impl
│       │   ├── merge/        applyMergeData(), extractMergeKeys()
│       │   └── print/        print styles, page-size mapping
│       └── package.json      # published as e.g. @talaatharb/doc-editor
├── apps/
│   ├── sample-fe/         # Vite + React 19 app consuming the library
│   └── sample-be/         # Spring Boot 4 + Java 25 + H2 (Maven)
├── turbo.json
└── .github/workflows/ci.yml
```

- **FE:** Vite, React 19, TypeScript strict. The library ships ESM + type declarations (build with tsup or Vite lib mode).
- **BE:** Spring Boot 4.1.1 (first-class Java 25 support, Java 17 minimum), Spring Web + Data JPA, H2 in embedded/file mode. Store content in a `TEXT`/`CLOB` column holding the JSON string (H2 doesn't need JSONB; any consumer DB can do the same).
- **Tooling:** pnpm, Turborepo, ESLint + Prettier, Vitest + Testing Library (library unit tests), Playwright (E2E against sample FE+BE), JUnit 5 + Testcontainers-optional for the BE.

### 1.4 Why the API must stay thin

The whole point of the pluggable backend is that the library depends **only on a TypeScript interface**, never on HTTP details. A consumer can: implement the interface against their own BE, embed the logic in-process, or point the default `FetchBackend` at a privately hosted copy of the sample API. The sample API is thus a *reference implementation*, not a dependency.

---

## 2. Proposed API

### 2.1 Library-facing interface (the contract consumers implement)

```ts
// @cegedim/doc-editor
export interface DocMeta {
  title: string;
  pageSize: 'A4' | 'Letter' | 'Legal' | 'A5';   // logical size
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number }; // mm
  schemaVersion: number;
}

export interface DocSummary { id: string; title: string; updatedAt: string; version: number; }
export interface DocContent {
  id: string;
  content: unknown;          // ProseMirror JSON doc
  meta: DocMeta;
  version: number;           // optimistic concurrency token
}

export interface AuthProvider {
  getAuthToken(): Promise<string | null>;   // default: fake/localStorage token
  onUnauthorized?(err: unknown): void;
}

export interface DocumentBackend {
  list(): Promise<DocSummary[]>;
  create(input: { title: string; meta?: Partial<DocMeta> }): Promise<DocSummary>;
  load(id: string): Promise<DocContent>;
  save(id: string, payload: {
    content: unknown;
    meta: DocMeta;
    baseVersion: number;     // expected current version → 409 on conflict
  }): Promise<{ version: number }>;
  remove(id: string): Promise<void>;
  auth?: AuthProvider;
}
```

Usage:

```tsx
<DocEditor
  backend={myCustomBackend}          // or omit → default FetchBackend({ baseUrl })
  documentId="doc-42"
  mergeData={{ clientName: "ACME", dueDate: "2026-12-01" }}  // optional
/>
```

### 2.2 Reference REST API (sample Spring Boot)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/token` | Fake auth — returns a static JWT-like token (overridable in real deployments) |
| `GET` | `/api/documents` | List summaries |
| `POST` | `/api/documents` | Create `{title, meta?}` |
| `GET` | `/api/documents/{id}` | Full content + meta + version |
| `PUT` | `/api/documents/{id}` | Save `{content, meta, baseVersion}` → `200 {version}` or `409 CONFLICT` |
| `DELETE` | `/api/documents/{id}` | Delete |
| `GET` | `/api/documents/{id}/versions` | Version history (audit log table) |
| `POST` | `/api/documents/{id}/versions/{v}/restore` | Restore |
| `GET` | `/api/documents/{id}/export?format=html\|pdf` | Server-side export (phase 3+) |

Design notes:
- **Optimistic concurrency** via `baseVersion`/`409` — cheap to implement, prevents silent overwrites.
- Every successful `PUT` inserts a row into `document_version(document_id, version, content, saved_at)` → free version history.
- Auth: a single `Bearer` filter; the sample issues tokens freely, but the filter exists so a real deployment just swaps the issuer.
- CORS configured for the sample FE origin; trivially tightened for private hosting.

---

## 3. Key Features

### 3.1 Pagination (the differentiator — and the hardest part)

Browser editors don't have a print-layout engine, so be honest about phasing:

- **Phase 1 (v1):** Schema-level page support:
  - `pageBreak` block node (Ctrl+Enter / toolbar button) — explicit page breaks, like Word's manual break.
  - `meta.pageSize` drives a **fixed-dimension page canvas**: each rendered "page" is a div sized exactly A4/Letter/etc. at 96dpi (A4 ≈ 794×1123 px) with the configured margins as padding. Content flows inside; a page shows an overflow indicator and the next page starts after a break.
  - Page-number footer rendered per page (decorative layer, not editable content).
- **Phase 2:** **Auto-pagination engine** — measure block heights with `Range.getClientRects()`/ResizeObserver and split overflowing blocks (paragraphs, tables) across pages, re-paginating on edit/debounce. This is the Google-Docs-style behavior; budget it as a separate milestone because it's genuinely the most engineering-heavy feature.
- **Printing works from Phase 1** (see below), which covers the common case of documents authored with explicit breaks.

### 3.2 Printing / PDF

- Dedicated `@media print` stylesheet: hide chrome (toolbar, sidebars), reset each `.page` to `size: A4; margin: 0` with `@page { size: A4 portrait; margin: 20mm }` matching the document's meta, `break-after: page` on page boundaries.
- "Print" button → `window.print()` → user picks printer or **"Save as PDF"** (browser-native, zero dependencies).
- Optional Phase 3: server-side PDF (render via Tiptap 3 SSR → styled HTML → headless Chromium or wkhtmltopdf) for programmatic exports.

### 3.3 Merge fields (your non-Word feature)

Two distinct capabilities, cleanly separated:

1. **Authoring placeholders** — custom inline node:
   ```json
   { "type": "mergeField", "attrs": { "key": "clientName", "label": "Client name?" } }
   ```
   Rendered as a highlighted chip (e.g., blue pill `«clientName»`). Toolbar command + keyboard shortcut insert it; a panel lists all keys used in the document (`extractMergeKeys(doc)` walks the doc).
2. **Applying data** — pure function, no editor state required:
   ```ts
   applyMergeData(docJson, map, opts?): MergedDoc
   // opts.mode: 'replace' (default) | 'highlight' (keep node, show value via Decoration)
   ```
   - `replace`: swap each `mergeField` node for a `text` node with the value (unknown keys → configurable fallback: leave placeholder, empty string, or red-flag marker).
   - `highlight`: use Tiptap 3's Decorations API to overlay values without mutating content — ideal for **live preview while typing the map**.
   - Flows: *edit template* (placeholders visible) → *load with map* (for saving a filled instance or printing) → *print*. The sample FE demonstrates both: a "Template view" and a "Fill & Print view".

### 3.4 Standard Word-like feature set

**Text:** bold, italic, underline, strikethrough, sub/superscript, font family/size, text & highlight color, character spacing (stretch).
**Blocks:** H1–H6 + Normal, paragraph spacing, alignment (L/C/R/J), line height, indent/outdent, horizontal rule.
**Lists:** bullet, numbered, nested; task lists (checkboxes) as a bonus.
**Tables:** insert/resize, cell merge, borders/shading, header row.
**Objects:** images (paste/upload → stored as data URL in v1, asset endpoint in v2), links, page break.
**Document:** title, page size/orientation/margins dialog, page numbers, header/footer (v2 — needs per-page decoration layer).
**Editing UX:** undo/redo (built-in history), find & replace (with regex option), word count, autosave (debounced PUT + dirty indicator + offline queue), keyboard shortcuts matching Word conventions (Ctrl+B/I/U, Ctrl+Enter page break…), placeholder text on empty docs, drag-drop images, paste-from-Word cleanup (Tiptap's paste parser + a strip-styles option).
**Later (nice-to-have):** comments, track changes, TOC, footnotes/endnotes, templates gallery, multi-language spellcheck.

---

## 4. Implementation Plan

### Phase 0 — Scaffolding
1. Init monorepo: pnpm workspaces, Turborepo, TS config, ESLint/Prettier, CI skeleton (build + test jobs).
2. `packages/editor`: tsup/Vite-lib setup, public entry, versioning.
3. `apps/sample-be`: Spring Initializr project (Boot 4, Java 25, Web, Data JPA, H2, Validation). Entities `Document`, `DocumentVersion`; repositories; DTOs; `@RestController` for the endpoints above; `SecurityFilter` stub with fake token; CORS config; Flyway or `schema.sql` for H2.
4. `apps/sample-fe`: Vite React app, proxy to `:8080`, login screen hitting the fake auth.

### Phase 1 — Core editor + persistence
5. Define the schema: Tiptap starterKit + Typography + Link + Image + Table + custom `pageBreak` node + `PageSize`/margins held in `meta` (not in the doc tree — cleaner).
6. Build `<DocEditor>`: takes `backend` + `documentId`, loads via `backend.load`, wires `onUpdate` → debounced `backend.save` with `baseVersion`, handles `409` (reload + notify), exposes `editorRef`.
7. Default `FetchBackend` implementing the reference REST API + swappable `AuthProvider` (fake default: static token in localStorage).
8. Toolbar component (headless commands + presentational buttons) covering the Phase-1 feature list; keyboard shortcuts.
9. Sample FE: document list, open/create/delete, autosave indicator.
10. Tests: Vitest for extensions & `applyMergeData`-style pure functions; Playwright smoke test (create → type → reload → content intact).

### Phase 2 — Pages, print, merge fields
11. Page canvas rendering: fixed-size page divs from `meta`, margin handling, page-break navigation (prev/next page, jump to page), zoom control.
12. Print pipeline: print stylesheet, `@page` sizing from meta, print button, verify A4/Letter output in Chrome/Firefox/Safari.
13. `mergeField` node + insertion UI + `extractMergeKeys` + `applyMergeData` (both modes) + "Fill & Print" flow in sample FE (map editor panel with live preview).
14. Find & replace, word count, image upload polish.

### Phase 3 — Hardening & extras
15. Auto-pagination engine (measure & split blocks) — the big-ticket item; ship behind a flag.
16. Version history UI (list/restore via existing endpoints).
17. Import/export: `.txt`, HTML (with DOMPurify on import), and **DOCX round-trip** (mammoth for import; `html-docx-js` or server-side conversion for export — evaluate, mark experimental).
18. Server-side PDF export endpoint (Tiptap 3 SSR → headless Chromium).
19. Headers/footers, comments, track changes — pick based on demand.
20. Library packaging polish: tree-shaking audit, Storybook docs site, semver + changelog, publish to your registry.

### Risks & mitigations
- **Auto-pagination complexity** → de-risked by shipping explicit page breaks + working print in v1; users get a usable product before the engine lands.
- **Schema evolution** → `schemaVersion` in meta + Tiptap 3 migration hooks from day one; never store raw HTML.
- **Backend lock-in** → the TS interface is the only coupling; keep the sample API ≤ ~8 endpoints so re-implementing it in any stack is an afternoon.
- **Print fidelity across browsers** → Playwright print-snapshot tests in CI against a golden document.
