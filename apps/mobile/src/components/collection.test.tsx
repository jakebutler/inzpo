import { InzpoApiError } from '@inzpo/shared';
import { fireEvent, render } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import CollectionScreen from '@/app/(app)/collection/[id]';
import { useInzpoClient } from '@/lib/api';
import { mockClient } from '../../tests/fixtures';

jest.mock('@/lib/api', () => ({ useInzpoClient: jest.fn() }));
let client: ReturnType<typeof mockClient>;
beforeEach(() => {
  client = mockClient();
  jest.mocked(useInzpoClient).mockReturnValue(client);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'collection-1' });
});

test('loads a read-only collection with photos, titles and roles, and returns to the saved kit', async () => {
  const view = await render(<CollectionScreen />);
  expect(await view.findByText('Neighborhood')).toBeTruthy();
  expect(view.getByText('A quiet house')).toBeTruthy();
  expect(view.getByLabelText('Photo for A quiet house')).toBeTruthy();
  expect(view.getByLabelText(/accent: No color yet/)).toBeTruthy();
  expect(client.getCollection).toHaveBeenCalledWith('collection-1');
  expect(view.queryByRole('button', { name: /Save|Edit|Delete/ })).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Back' }));
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('an empty collection shows an empty state', async () => {
  client.getCollection.mockResolvedValue({ id: 'collection-1', name: 'Neighborhood', kits: [] });
  const view = await render(<CollectionScreen />);
  expect(await view.findByText('No kits in this collection yet.')).toBeTruthy();
});

test('a large collection mounts only a window of photo rows', async () => {
  const collection = await client.getCollection('collection-1');
  client.getCollection.mockResolvedValue({ ...collection,
    kits: Array.from({ length: 40 }, (_, index) => ({ ...collection.kits[0], id: `kit-${index}` })) });
  const view = await render(<CollectionScreen />);
  await view.findByText('Neighborhood');
  expect(view.getAllByTestId(/^collection-kit-/).length).toBeLessThan(40);
});

test.each([404, 500])('a %s error is recoverable', async (status) => {
  client.getCollection.mockRejectedValueOnce(new InzpoApiError(status, 'offline'));
  const view = await render(<CollectionScreen />);
  expect(await view.findByRole('alert')).toHaveTextContent(status === 404
    ? 'This collection couldn’t be found.' : 'Couldn’t load this collection. Please try again.');
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(await view.findByText('Neighborhood')).toBeTruthy();
  expect(client.getCollection).toHaveBeenCalledTimes(2);
});
