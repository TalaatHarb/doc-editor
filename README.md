# Doc Editor

A browser-based word-like document editor, built as a React library with a replaceable backend and a Spring Boot reference API.

## Getting started

Requirements: Node.js 22+, Java 25+, Maven 3.9+, and pnpm 10 or newer (any version works locally; CI uses 12.11.2).

```sh
pnpm install
pnpm dev
```

In a second terminal, start the sample API:

```sh
cd apps/sample-be
mvn spring-boot:run
```

Open the Vite URL printed by `pnpm dev`. The sample API runs on `http://localhost:8080`; the frontend proxies `/api` requests to it.

## Workspace

- `packages/editor`: typed React editor library, backend contract, fetch adapter, page-break extension, and merge-field utilities.
- `apps/sample-fe`: Vite + React demo with document management, formatting, autosave, and print.
- `apps/sample-be`: Spring Boot + H2 reference REST API with optimistic concurrency and version history.

The editor library depends on the `DocumentBackend` interface, not the sample API. Supply your own implementation to connect another service.

## Features

- **Formatting**: bold/italic/underline/strike, sub/superscript, font family & size, text/highlight colour, headings, alignment, bullet/numbered/task lists, quotes, links, horizontal rules, tables (with row/column/merge controls) and images (upload, paste, drop).
- **Pages**: paper size, orientation and margins (Page setup), explicit page breaks, page count / go-to-page, zoom, print CSS.
- **Merge fields**: inline `{{key}}` nodes (Ctrl+Shift+M), highlight toggle, keys panel, and a read-only preview with merge data (`mode="preview"` + `mergeData`). The sample app shows this as "Fill & Print".
- **Find & replace** (Ctrl+F) with match-case and regex, plus word/character count.
- **Import / export**: export to HTML, text or JSON; import `.html` (sanitised with DOMPurify), `.txt` or `.json`.
- **Persistence**: explicit save (Save button / Ctrl+S; `autosave` prop opts into debounced autosave), unsaved edits are kept as a local draft, with optimistic concurrency and a version history panel (when the backend implements `listVersions`/`restoreVersion`).
- **Headers & footers**: set in Page setup with `{page}`/`{pages}` tokens. Printing uses CSS `@page` margin boxes (per-page numbers; Chrome 131+ recommended).
- **Automatic pagination (experimental)**: `autoPagination` prop draws page boundaries from content height and feeds the page count. Content is not physically split in the editor; print splits naturally.
- **Offline & conflicts**: when a save fails because the network is down, the draft stays in `localStorage` and is retried when back online; a 409 shows a banner to keep your version or load the server's. Errors are recognised by `ConflictError`/`NetworkError` names, so custom backends can opt in.
- **Server export**: optional `exportDocument(id, format)` on the backend; the sample API serves `GET /api/documents/{id}/export?format=html|txt|json|pdf` (PDF is text-only, no images/inline styling).
- `editorRef` exposes the underlying Tiptap `Editor`.

Not yet implemented: DOCX export, physical content splitting across pages, true multi-operation offline queue.

## Commands

```sh
pnpm dev                 # frontend
pnpm build               # build all frontend workspaces
pnpm test                # editor unit tests
pnpm lint                # ESLint
pnpm format              # Prettier check
cd apps/sample-be && mvn test
```

Demo sign-in: any non-blank username with password `demo`. Documents are stored as ProseMirror JSON with versioned metadata; HTML is never used in the persistence contract. H2 uses a local file by default. The sample token endpoint and static bearer token are for local demonstration only, not production authentication.

