import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, FetchBackend, NetworkError } from './fetch-backend';

const backend = () =>
  new FetchBackend({
    baseUrl: 'http://x/',
    auth: { getAuthToken: async () => 'tok' },
  });

const payload = { content: {}, meta: {} as never, baseVersion: 1 };

afterEach(() => vi.unstubAllGlobals());

describe('FetchBackend', () => {
  it('maps 409 to ConflictError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 409 })),
    );
    await expect(backend().save('1', payload)).rejects.toBeInstanceOf(ConflictError);
  });

  it('maps fetch failures to NetworkError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('down'))),
    );
    await expect(backend().list()).rejects.toBeInstanceOf(NetworkError);
  });

  it('sends the bearer token and returns JSON', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(backend().list()).resolves.toEqual([]);
    const url = (fetchMock.mock.calls[0] as unknown[])[0];
    expect(url).toBe('http://x/api/documents');
  });
});
