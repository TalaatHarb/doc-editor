import type {
  AuthProvider,
  DocContent,
  DocMeta,
  DocSummary,
  DocVersionSummary,
  DocumentBackend,
} from '../types';

const TOKEN_KEY = 'doc-editor-token';

/** The server holds a newer version of the document than the one being saved. */
export class ConflictError extends Error {
  constructor() {
    super('This document changed on the server.');
    this.name = 'ConflictError';
  }
}

/** The request never reached the server (offline, DNS, CORS, server down). */
export class NetworkError extends Error {
  constructor() {
    super('You appear to be offline. Changes will be retried automatically.');
    this.name = 'NetworkError';
  }
}

async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new NetworkError();
  }
}

export class FetchBackend implements DocumentBackend {
  readonly auth: AuthProvider;
  private readonly baseUrl: string;

  constructor(options: { baseUrl: string; auth?: AuthProvider }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.auth = options.auth ?? {
      getAuthToken: async () =>
        typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem(TOKEN_KEY),
    };
  }

  async list(): Promise<DocSummary[]> {
    return this.request<DocSummary[]>('/api/documents');
  }

  async create(input: { title: string; meta?: Partial<DocMeta> }): Promise<DocSummary> {
    return this.request<DocSummary>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async load(id: string): Promise<DocContent> {
    return this.request<DocContent>(`/api/documents/${encodeURIComponent(id)}`);
  }

  async save(
    id: string,
    payload: { content: unknown; meta: DocMeta; baseVersion: number },
  ): Promise<{ version: number }> {
    return this.request<{ version: number }>(`/api/documents/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async remove(id: string): Promise<void> {
    await this.request<void>(`/api/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async listVersions(id: string): Promise<DocVersionSummary[]> {
    return this.request<DocVersionSummary[]>(`/api/documents/${encodeURIComponent(id)}/versions`);
  }

  async restoreVersion(id: string, version: number): Promise<{ version: number }> {
    return this.request<{ version: number }>(
      `/api/documents/${encodeURIComponent(id)}/versions/${version}/restore`,
      { method: 'POST' },
    );
  }

  /** Demo login against `/api/auth/token`; stores the token in localStorage. */
  async login(username: string, password: string): Promise<void> {
    const response = await safeFetch(`${this.baseUrl}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (response.status === 401) throw new Error('Wrong username or password.');
    if (!response.ok) throw new Error(`Sign in failed (${response.status})`);
    const result = (await response.json()) as { token: string };
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, result.token);
  }

  logout(): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  }

  async hasToken(): Promise<boolean> {
    return Boolean(await this.auth.getAuthToken());
  }

  /** Server-side export (`html`, `txt`, `json` or `pdf`) as a Blob. */
  async exportDocument(id: string, format: 'html' | 'txt' | 'json' | 'pdf'): Promise<Blob> {
    const token = await this.auth.getAuthToken();
    const response = await safeFetch(
      `${this.baseUrl}/api/documents/${encodeURIComponent(id)}/export?format=${format}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (response.status === 401) this.handleUnauthorized();
    if (!response.ok) throw new Error(`Export failed (${response.status})`);
    return response.blob();
  }

  private handleUnauthorized(): never {
    const error = new Error('Your session is unauthorized. Sign in again to continue.');
    this.auth.onUnauthorized?.(error);
    throw error;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.auth.getAuthToken();
    const response = await safeFetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

    if (response.status === 401) this.handleUnauthorized();
    if (response.status === 409) throw new ConflictError();
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Request failed (${response.status})${body ? `: ${body}` : ''}`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}
