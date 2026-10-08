import { kitFixture } from '../../tests/fixtures';
import { useKit } from './use-kit';
import { Text } from 'react-native';
import { createElement, useEffect } from 'react';
import { render, renderHook } from '@testing-library/react-native';
import { useAuth } from '@clerk/expo';
import { createMobileClient, DEFAULT_API_BASE_URL, InzpoClientProvider, useInzpoClient } from './api';

const originalFetch = global.fetch;
const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const fetchMock = jest.fn();

beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
});
afterEach(() => {
  global.fetch = originalFetch;
  if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
});

test('uses the configured origin and a fresh Clerk Bearer token on every request', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example/';
  const getToken = jest.fn().mockResolvedValueOnce('first-token').mockResolvedValueOnce('second-token');
  const client = createMobileClient(getToken);
  await client.listCollections();
  await client.listCollections();
  expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.example/api/mobile/collections', {
    method: 'GET', headers: { Authorization: 'Bearer first-token' },
  });
  expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.example/api/mobile/collections', {
    method: 'GET', headers: { Authorization: 'Bearer second-token' },
  });
});

test('uses the default origin when the environment variable is absent', async () => {
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
  await createMobileClient(async () => 'token').listCollections();
  expect(fetchMock).toHaveBeenCalledWith(`${DEFAULT_API_BASE_URL}/api/mobile/collections`, expect.anything());
});

test('does not make an unauthenticated request', async () => {
  await expect(createMobileClient(async () => null).listCollections()).rejects.toMatchObject({ status: 401 });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('supplies one stable client through context with Clerk getToken', async () => {
  const getToken = jest.fn(async () => 'context-token');
  jest.mocked(useAuth).mockReturnValue({ isLoaded: true, isSignedIn: true, getToken } as unknown as ReturnType<typeof useAuth>);
  const clients: ReturnType<typeof createMobileClient>[] = [];
  function Consumer() {
    clients.push(useInzpoClient());
    return createElement(Text, null, 'Connected');
  }
  const view = await render(createElement(InzpoClientProvider, null, createElement(Consumer)));
  const latestToken = jest.fn(async () => 'latest-token');
  jest.mocked(useAuth).mockReturnValue({ getToken: latestToken } as unknown as ReturnType<typeof useAuth>);
  await view.rerender(createElement(InzpoClientProvider, null, createElement(Consumer)));
  expect(clients[0]).toBe(clients[clients.length - 1]);
  await clients[0].listCollections();
  expect(getToken).not.toHaveBeenCalled();
  expect(latestToken).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { Authorization: 'Bearer latest-token' } }));
});

test('provider auth rerenders do not reset useKit or refetch the kit', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => kitFixture });
  const hook = await renderHook(() => useKit('kit-1'), { wrapper: InzpoClientProvider });
  expect(hook.result.current.kit).toEqual(kitFixture);
  jest.mocked(useAuth).mockReturnValue({ getToken: jest.fn(async () => 'new-token') } as unknown as ReturnType<typeof useAuth>);
  await hook.rerender({});
  expect(hook.result.current.kit).toEqual(kitFixture);
  expect(hook.result.current.loading).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('a newly mounted consumer uses the latest token during its first passive effect', async () => {
  const oldToken = jest.fn(async () => 'old');
  const newToken = jest.fn(async () => 'new');
  jest.mocked(useAuth).mockReturnValue({ getToken: oldToken } as unknown as ReturnType<typeof useAuth>);
  function Consumer() {
    const client = useInzpoClient();
    useEffect(() => { void client.listCollections(); }, [client]);
    return null;
  }
  const view = await render(createElement(InzpoClientProvider));
  jest.mocked(useAuth).mockReturnValue({ getToken: newToken } as unknown as ReturnType<typeof useAuth>);
  await view.rerender(createElement(InzpoClientProvider, null, createElement(Consumer)));
  expect(oldToken).not.toHaveBeenCalled();
  expect(newToken).toHaveBeenCalledTimes(1);
});
