import { Text } from 'react-native';
import { createElement } from 'react';
import { render } from '@testing-library/react-native';
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
  await view.rerender(createElement(InzpoClientProvider, null, createElement(Consumer)));
  expect(clients[0]).toBe(clients[clients.length - 1]);
  await clients[0].listCollections();
  expect(getToken).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { Authorization: 'Bearer context-token' } }));
});
