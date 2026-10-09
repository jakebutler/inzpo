import { act, fireEvent, render } from '@testing-library/react-native';
import * as ExpoHaptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';
import { SaveSheetContent } from './SaveSheetContent';
import { useInzpoClient } from '@/lib/api';
import { createHaptics, haptics } from '@/lib/haptics';
import { mockClient } from '../../tests/fixtures';

jest.mock('@/lib/api', () => ({ useInzpoClient: jest.fn() }));
let client: ReturnType<typeof mockClient>;
const onClose = jest.fn();
beforeEach(() => {
  client = mockClient();
  jest.mocked(useInzpoClient).mockReturnValue(client);
  jest.mocked(useReducedMotion).mockReturnValue(false);
  Object.assign(haptics, createHaptics());
});
afterEach(() => jest.useRealTimers());

test('renders collections, picks one, and saves with collectionId', async () => {
  const view = await render(<SaveSheetContent kitId="kit-1" onClose={onClose} />);
  expect(view.getByText('Keep this kit')).toBeTruthy();
  expect(await view.findByText('Neighborhood')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Save kit' })).toBeDisabled();
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(client.saveKit).toHaveBeenCalledWith('kit-1', { collectionId: 'collection-1' });
  expect(view.getByText('Saved')).toBeTruthy();
  expect(view.getByTestId('baku-success')).toBeTruthy();
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(ExpoHaptics.NotificationFeedbackType.Success);
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(view.getByTestId('save-check')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('typing a new name clears an existing choice and sends only newName', async () => {
  const view = await render(<SaveSheetContent kitId="kit-1" onClose={onClose} />);
  await view.findByText('Neighborhood');
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  await fireEvent.changeText(view.getByLabelText('New collection name'), '  Sunday walks  ');
  expect(view.getByRole('radio', { name: /Neighborhood/ })).not.toBeChecked();
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(client.saveKit).toHaveBeenCalledWith('kit-1', { newName: 'Sunday walks' });
  expect(view.getByText('Saved')).toBeTruthy();
});

test('a save error keeps the selection available for retry', async () => {
  client.saveKit.mockRejectedValueOnce(new Error('offline'));
  const view = await render(<SaveSheetContent kitId="kit-1" onClose={onClose} />);
  await view.findByText('Neighborhood');
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(view.getByText('Couldn’t save this kit. Please try again.')).toBeTruthy();
  expect(view.getByTestId('baku-errorBrief')).toBeTruthy();
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(ExpoHaptics.NotificationFeedbackType.Error);
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(view.queryByText('Saved')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(view.getByText('Saved')).toBeTruthy();
});

test('collection loading failure can be retried', async () => {
  client.listCollections.mockRejectedValueOnce(new Error('offline'));
  const view = await render(<SaveSheetContent kitId="kit-1" onClose={onClose} />);
  expect(await view.findByText('Couldn’t load collections. Please try again.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Reload collections' }));
  expect(await view.findByText('Neighborhood')).toBeTruthy();
});

test('whitespace alone cannot create a new collection', async () => {
  const view = await render(<SaveSheetContent kitId="kit-1" onClose={onClose} />);
  await fireEvent.changeText(view.getByLabelText('New collection name'), '   ');
  expect(view.getByRole('button', { name: 'Save kit' })).toBeDisabled();
});

test.each([false, true])('success holds for 2s then returns to idle (reduced motion: %s)', async (reducedMotion) => {
  jest.useFakeTimers();
  jest.mocked(useReducedMotion).mockReturnValue(reducedMotion);
  const view = await render(<SaveSheetContent kitId="kit-1" onClose={onClose} />);
  expect(view.getByLabelText('New collection name').props.autoFocus).toBe(true);
  await fireEvent.changeText(view.getByLabelText('New collection name'), 'Walks');
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(view.getByTestId('baku-success')).toBeTruthy();
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(ExpoHaptics.NotificationFeedbackType.Success);
  await act(async () => { jest.advanceTimersByTime(1999); });
  expect(view.getByTestId('baku-success')).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(view.getByTestId('baku-idle')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Saved' })).toBeDisabled();
  await view.unmount();
  jest.useRealTimers();
});


test('success reports the collection and automatically dismisses after 900ms', async () => {
  jest.useFakeTimers();
  const onSaved = jest.fn();
  const view = await render(<SaveSheetContent kitId="kit-1" onClose={onClose} onSaved={onSaved} />);
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(onSaved).toHaveBeenCalledWith({ collectionId: 'collection-1', collectionName: 'Neighborhood' });
  expect(onSaved).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(899); });
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(onClose).toHaveBeenCalledTimes(1);
  await view.unmount();
  jest.useRealTimers();
});

test('success reports the trimmed new collection name', async () => {
  const onSaved = jest.fn();
  const view = await render(<SaveSheetContent kitId="kit-1" onClose={onClose} onSaved={onSaved} />);
  await fireEvent.changeText(view.getByLabelText('New collection name'), '  Walks  ');
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(onSaved).toHaveBeenCalledWith({ collectionId: 'collection-1', collectionName: 'Walks' });
});

test('unmounting after success cancels the automatic dismissal timer', async () => {
  jest.useFakeTimers();
  const view = await render(<SaveSheetContent kitId="kit-1" onClose={onClose} />);
  await fireEvent.changeText(view.getByLabelText('New collection name'), 'Walks');
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  await view.unmount();
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(onClose).not.toHaveBeenCalled();
});
