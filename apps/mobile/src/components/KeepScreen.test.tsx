import { act, fireEvent, render, within } from '@testing-library/react-native';
import * as ExpoHaptics from 'expo-haptics';
import { useReducedMotion } from 'react-native-reanimated';
import * as Native from 'react-native';
import { KeepScreen } from './KeepScreen';
import { useInzpoClient } from '@/lib/api';
import { createHaptics, haptics } from '@/lib/haptics';
import { kitFixture, mockClient } from '../../tests/fixtures';

jest.mock('@/lib/api', () => ({ useInzpoClient: jest.fn() }));
let client: ReturnType<typeof mockClient>;
const onClose = jest.fn();
beforeEach(() => {
  client = mockClient();
  jest.mocked(useInzpoClient).mockReturnValue(client);
  jest.mocked(useReducedMotion).mockReturnValue(false);
  Object.assign(haptics, createHaptics());
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('renders collections, picks one, and saves with collectionId', async () => {
  const view = await render(<KeepScreen kitId="kit-1" onClose={onClose} />);
  expect(view.getByText('Keep this kit')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  expect(await view.findAllByText('Neighborhood')).not.toHaveLength(0);
  expect(view.getByRole('button', { name: 'Save kit' })).toBeEnabled();
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(client.saveKit).toHaveBeenCalledWith('kit-1', { collectionId: 'collection-1', title: 'Untitled kit' });
  expect(view.getByText('Saved')).toBeTruthy();
  expect(view.queryByTestId('keep-baku')).toBeNull();
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(ExpoHaptics.NotificationFeedbackType.Success);
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(view.getByTestId('save-check')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('starting a new collection replaces the existing collection choice', async () => {
  const view = await render(<KeepScreen kitId="kit-1" onClose={onClose} />);
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  await view.findAllByText('Neighborhood');
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  await fireEvent.press(view.getByRole('radio', { name: 'Start a new collection' }));
  await fireEvent.changeText(view.getByLabelText('New collection name'), '  Sunday walks  ');
  expect(view.queryByText('Neighborhood')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(client.saveKit).toHaveBeenCalledWith('kit-1', { newName: 'Sunday walks', title: 'Untitled kit' });
  expect(view.getByText('Saved')).toBeTruthy();
});

test('a save error keeps the selection available for retry', async () => {
  client.saveKit.mockRejectedValueOnce(new Error('offline'));
  const view = await render(<KeepScreen kitId="kit-1" onClose={onClose} />);
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  await view.findAllByText('Neighborhood');
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(view.getByText('Couldn’t save this kit. Please try again.')).toBeTruthy();
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(ExpoHaptics.NotificationFeedbackType.Error);
  expect(ExpoHaptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(view.queryByText('Saved')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(view.getByText('Saved')).toBeTruthy();
});

test('collection loading failure can be retried', async () => {
  client.listCollections.mockRejectedValueOnce(new Error('offline'));
  const view = await render(<KeepScreen kitId="kit-1" onClose={onClose} />);
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  expect(await view.findByText('Couldn’t load collections. Please try again.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Reload collections' }));
  expect(await view.findAllByText('Neighborhood')).not.toHaveLength(0);
});

test('clearing the name uses the default and keeps Save enabled', async () => {
  client.listCollections.mockResolvedValue([]);
  const view = await render(<KeepScreen kitId="kit-1" onClose={onClose} />);
  await fireEvent.changeText(view.getByLabelText('New collection name'), '   ');
  expect(view.getByRole('button', { name: 'Save kit' })).toBeEnabled();
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(client.saveKit).toHaveBeenCalledWith('kit-1', { newName: 'My collection', title: 'Untitled kit' });
});

test('a full-screen Keep prefills the kit title and omits Baku', async () => {
  const view = await render(<KeepScreen kitId="kit-1" kit={kitFixture} onClose={onClose} />);
  expect(view.getByTestId('keep-screen')).toBeTruthy();
  expect(view.getAllByText('Keep this kit')).toHaveLength(1);
  expect(view.getByLabelText('Kit name').props.value).toBe(kitFixture.title);
  expect(view.getByText('Neighborhood')).toBeTruthy();
  expect(view.queryByLabelText('New collection name')).toBeNull();
  expect(view.queryByTestId('keep-baku')).toBeNull();
  expect(view.getByRole('button', { name: 'Save kit' })).toBeEnabled();
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(client.saveKit).toHaveBeenCalledWith('kit-1', { collectionId: 'collection-1', title: kitFixture.title });
});

test('success reports the collection and automatically dismisses after 900ms', async () => {
  jest.useFakeTimers();
  const onSaved = jest.fn();
  const view = await render(<KeepScreen kitId="kit-1" onClose={onClose} onSaved={onSaved} />);
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
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
  client.listCollections.mockResolvedValue([]);
  const onSaved = jest.fn();
  const view = await render(<KeepScreen kitId="kit-1" onClose={onClose} onSaved={onSaved} />);
  await fireEvent.changeText(view.getByLabelText('New collection name'), '  Walks  ');
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(onSaved).toHaveBeenCalledWith({ collectionId: 'collection-1', collectionName: 'Walks' });
});

test('unmounting after success cancels the automatic dismissal timer', async () => {
  jest.useFakeTimers();
  const view = await render(<KeepScreen kitId="kit-1" onClose={onClose} />);
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  await view.unmount();
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(onClose).not.toHaveBeenCalled();
});


test('choosing a collection leaves the header outside the changing scroll area', async () => {
  const view = await render(<KeepScreen kitId="kit-1" kit={kitFixture} onClose={onClose} />);
  const before = view.getByTestId('keep-header').props.style;
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  expect(view.getByTestId('keep-header')).toHaveStyle(before);
  expect(within(view.getByTestId('keep-scroll')).queryByText('Keep this kit')).toBeNull();
  expect(view.getByText('Neighborhood')).toBeTruthy();
});

test.each([{ width: 390, height: 844 }, { width: 375, height: 667 }])('Keep pins its measured header and constrains the scrolling viewport at $width', async (screen) => {
  jest.spyOn(Native.Dimensions, 'get').mockReturnValue({ ...screen, scale: 3, fontScale: 1 });
  const view = await render(<KeepScreen kitId="kit-1" kit={kitFixture} onClose={onClose} />);
  await fireEvent(view.getByTestId('keep-header'), 'layout', { nativeEvent: { layout: { height: 120 } } });
  const checkLayout = () => {
    expect(view.getByTestId('keep-header')).toHaveStyle({ position: 'absolute', top: 0, flexShrink: 0, width: screen.width - 40 });
    expect(view.getByTestId('keep-scroll')).toHaveStyle({ flex: 1, flexBasis: 0, minHeight: 0, marginTop: 120 });
    expect(view.getByTestId('keep-collection-row')).toHaveStyle({ minHeight: 44 });
  };
  checkLayout();
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  checkLayout();
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  checkLayout();
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  await fireEvent.press(view.getByRole('radio', { name: 'Start a new collection' }));
  checkLayout();
  expect(view.getByLabelText('New collection name')).toHaveStyle({ height: 20, lineHeight: 20 });
});

test.each([{ width: 390, height: 844 }, { width: 375, height: 667 }])('the complete fan, selected collection and footer fit without scrolling at $width', async (screen) => {
  jest.spyOn(Native.Dimensions, 'get').mockReturnValue({ ...screen, scale: 3, fontScale: 1 });
  const scrollTo = jest.spyOn(Native.ScrollView.prototype, 'scrollTo');
  const view = await render(<KeepScreen kitId="kit-1" kit={kitFixture} onClose={onClose} />);
  const viewportHeight = screen.height - 120 - 84;
  await fireEvent(view.getByTestId('keep-header'), 'layout', { nativeEvent: { layout: { height: 120 } } });
  await fireEvent(view.getByTestId('keep-scroll'), 'layout', { nativeEvent: { layout: { height: viewportHeight } } });
  await fireEvent(view.getByTestId('keep-form'), 'layout', { nativeEvent: { layout: { height: 180 } } });
  await fireEvent.press(view.getByRole('button', { name: 'Choose collection' }));
  // The taller picker can scroll. Selecting a collection must restore the fan's top.
  await fireEvent(view.getByTestId('keep-form'), 'layout', { nativeEvent: { layout: { height: 400 } } });
  await fireEvent.press(view.getByRole('radio', { name: /Neighborhood/ }));
  await fireEvent(view.getByTestId('keep-form'), 'layout', { nativeEvent: { layout: { height: 180 } } });
  const artHeight = Native.StyleSheet.flatten(view.getByTestId('keep-art').props.style).height;
  expect(artHeight).toBeGreaterThan(0);
  expect(artHeight + 180 + 16).toBeLessThanOrEqual(viewportHeight);
  expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
  expect(view.getByTestId('keep-footer')).toHaveStyle({ flexShrink: 0 });
  expect(view.getByRole('button', { name: 'Save kit' })).toBeEnabled();
});

test('Save waits for destinations, then reuses the existing collection without creating a duplicate', async () => {
  let resolve!: (rows: { id: string; name: string; count: number }[]) => void;
  client.listCollections.mockReturnValue(new Promise(done => { resolve = done; }));
  const view = await render(<KeepScreen kitId="kit-1" onClose={onClose} />);
  expect(view.getByRole('button', { name: 'Save kit' })).toBeDisabled();
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(client.saveKit).not.toHaveBeenCalled();
  await act(async () => resolve([{ id: 'existing', name: 'My collection', count: 7 }]));
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  expect(client.saveKit).toHaveBeenCalledWith('kit-1', { title: 'Untitled kit', collectionId: 'existing' });
  expect(view.getByText('Saved to My collection.')).toBeTruthy();
});

test('save confirmation retains the measured form and artwork footprint', async () => {
  jest.useFakeTimers();
  const view = await render(<KeepScreen kitId="kit-1" kit={kitFixture} onClose={onClose} />);
  await fireEvent(view.getByTestId('keep-scroll'), 'layout', { nativeEvent: { layout: { height: 460 } } });
  await fireEvent(view.getByTestId('keep-form'), 'layout', { nativeEvent: { layout: { height: 182 } } });
  const before = Native.StyleSheet.flatten(view.getByTestId('keep-art').props.style).height;
  await fireEvent.press(view.getByRole('button', { name: 'Save kit' }));
  await fireEvent(view.getByTestId('keep-form'), 'layout', { nativeEvent: { layout: { height: 24 } } });
  expect(view.getByTestId('keep-art')).toHaveStyle({ height: before });
  expect(view.getByTestId('keep-form')).toHaveStyle({ minHeight: 182 });
});
