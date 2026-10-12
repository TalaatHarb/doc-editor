import type {
  AuthProvider,
  DocContent,
  DocMeta,
  DocSummary,
  DocVersionSummary,
  DocumentBackend,
} from '../types';

export class FetchBackend implements DocumentBackend {
  readonly auth: AuthProvider;
  private readonly baseUrl: string;

  constructor(options: { baseUrl: string; auth?: AuthProvider }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.auth = options.auth ?? {
      getAuthToken: async () =>
        typeof localStorage === 'undefined'
          ? null
          : localStorage.getItem('doc-editor-token'),
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

  async issueDemoToken(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/auth/token`, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Could not obtain demo token (${response.status})`);
    }
    const result = (await response.json()) as { token: string };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('doc-editor-token', result.token);
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.auth.getAuthToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

    if (response.status === 401) {
      const error = new Error('Your session is unauthorized. Sign in again to continue.');
      this.auth.onUnauthorized?.(error);
      throw error;
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        response.status === 409
          ? 'This document changed on the server. Reload it before saving more edits.'
          : `Request failed (${response.status})${body ? `: ${body}` : ''}`,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}
