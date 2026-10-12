# Doc Editor

A browser-based word-like document editor, built as a React library with a replaceable backend and a Spring Boot reference API.

## Getting started

Requirements: Node.js 22+, Java 25+, Maven 3.9+, and pnpm 10+.

```sh
corepack enable
corepack prepare pnpm@10.12.1 --activate
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
- **Persistence**: debounced autosave with optimistic concurrency and a version history panel (when the backend implements `listVersions`/`restoreVersion`).
- `editorRef` exposes the underlying Tiptap `Editor`.

Not yet implemented: automatic pagination, import/export (DOCX/PDF/HTML), headers/footers, login screen, offline queue.

## Commands

```sh
pnpm dev                 # frontend
pnpm build               # build all frontend workspaces
pnpm test                # editor unit tests
cd apps/sample-be && mvn test
```

Documents are stored as ProseMirror JSON with versioned metadata; HTML is never used in the persistence contract. H2 uses a local file by default. The sample token endpoint and static bearer token are for local demonstration only, not production authentication.

Pagination currently supports explicit page breaks and paper sizing for print. It does not automatically split overflowing content across pages.
