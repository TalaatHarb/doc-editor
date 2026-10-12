export type PageSize = 'A4' | 'Letter' | 'Legal' | 'A5';

export interface DocMeta {
  title: string;
  pageSize: PageSize;
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  schemaVersion: number;
}

export interface DocSummary {
  id: string;
  title: string;
  updatedAt: string;
  version: number;
}

export interface DocContent {
  id: string;
  content: unknown;
  meta: DocMeta;
  version: number;
}

export interface DocVersionSummary {
  version: number;
  savedAt: string;
}

export interface AuthProvider {
  getAuthToken(): Promise<string | null>;
  onUnauthorized?(error: unknown): void;
}

export interface DocumentBackend {
  list(): Promise<DocSummary[]>;
  create(input: { title: string; meta?: Partial<DocMeta> }): Promise<DocSummary>;
  load(id: string): Promise<DocContent>;
  save(
    id: string,
    payload: { content: unknown; meta: DocMeta; baseVersion: number },
  ): Promise<{ version: number }>;
  remove(id: string): Promise<void>;
  /** Optional: enables the version history panel. */
  listVersions?(id: string): Promise<DocVersionSummary[]>;
  /** Optional: restores a version (server creates a new version from it). */
  restoreVersion?(id: string, version: number): Promise<{ version: number }>;
  auth?: AuthProvider;
}

export const DEFAULT_DOC_META: DocMeta = {
  title: 'Untitled document',
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  schemaVersion: 1,
};
