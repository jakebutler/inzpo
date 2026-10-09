import { act, fireEvent, render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import * as RN from 'react-native';
import { kitFixture } from '../../tests/fixtures';
import { ChipDetail } from './ChipDetail';

const slot = { role: 'primary' as const, x: 0, y: 0, width: 132, height: 196, rotation: -1.2, zIndex: 12 };
const kit = { ...kitFixture, photo: { ...kitFixture.photo!, width: 1500, height: 2000 },
  roles: { ...kitFixture.roles, primary: '#d1cb9e', text: '#050404' } };
const onClose = jest.fn();
const onEdit = jest.fn();
beforeEach(() => {
  jest.useFakeTimers(); jest.mocked(Reanimated.useReducedMotion).mockReturnValue(false);
  jest.spyOn(RN.Dimensions, 'get').mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

async function detail() {
  return render(<ChipDetail kit={kit} role="primary" slot={slot} origin={{ x: 20, y: 370 }} onClose={onClose} onEdit={onEdit} />);
}

test('lifts then flips with 3D perspective, exposes the back, and reverses before seating', async () => {
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const delay = jest.spyOn(Reanimated, 'withDelay');
  const view = await detail();
  expect(timing).toHaveBeenCalledWith(-6, { duration: 120 });
  expect(timing).toHaveBeenCalledWith(1.04, { duration: 120 });
  expect(timing).toHaveBeenCalledWith(180, { duration: 420 });
  expect(delay).toHaveBeenCalledWith(120, expect.anything());
  expect(view.getByTestId('chip-detail-front')).toHaveStyle({ backfaceVisibility: 'hidden' });
  expect(view.getByTestId('chip-detail-back', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  await act(async () => jest.advanceTimersByTime(540));
  const toggle = view.getByRole('button', { name: /Your text color reads well on this yellow/ });
  expect(toggle.props.accessibilityState).toEqual({ expanded: true });
  expect(view.getByTestId('chip-detail-back')).toHaveStyle({ width: 210, height: 390,
    transform: [{ perspective: 900 }, { rotateY: '0deg' }] });
  expect(view.getByTestId('chip-detail-front', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  await fireEvent.press(toggle);
  expect(timing).toHaveBeenCalledWith(0, { duration: 420 });
  await act(async () => jest.advanceTimersByTime(539));
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1));
  expect(onClose).toHaveBeenCalledTimes(1);
  await view.unmount();
});

test('reduced motion crossfades without lift, scale, delayed rotation or perspective', async () => {
  jest.mocked(Reanimated.useReducedMotion).mockReturnValue(true);
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const delay = jest.spyOn(Reanimated, 'withDelay');
  const view = await detail();
  expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 150 }));
  expect(delay).not.toHaveBeenCalled();
  expect(timing).not.toHaveBeenCalledWith(-6, expect.anything());
  expect(timing).not.toHaveBeenCalledWith(1.04, expect.anything());
  expect(timing).not.toHaveBeenCalledWith(180, expect.anything());
  await act(async () => jest.advanceTimersByTime(150));
  expect(view.getByTestId('chip-detail-back')).toHaveStyle({ opacity: 1, transform: [] });
  expect(view.getByTestId('chip-detail-front', { includeHiddenElements: true })).toHaveStyle({ opacity: 0, transform: [] });
  await fireEvent.press(view.getByTestId('chip-detail-toggle'));
  expect(timing).toHaveBeenCalledWith(0, expect.objectContaining({ duration: 150 }));
  await act(async () => jest.advanceTimersByTime(150));
  expect(onClose).toHaveBeenCalledTimes(1);
  await view.unmount();
});

test('manual colors have no source crop and measured colors center the exact sample', async () => {
  const view = await detail();
  await act(async () => jest.advanceTimersByTime(540));
  expect(view.queryByTestId('chip-photo-crop')).toBeNull();
  expect(view.getByText('Chosen by you. No photo sample attached.')).toBeTruthy();
  const sampledKit = { ...kit, colors: [{ hex: '#D1CB9E', role: 'primary' as const, name: 'yellow', origin: 'sampled', pinX: 0.3, pinY: 0.4 }] };
  await view.rerender(<ChipDetail kit={sampledKit} role="primary" slot={slot} origin={{ x: 20, y: 370 }} onClose={onClose} onEdit={onEdit} />);
  expect(view.getByTestId('chip-photo-crop')).toHaveStyle({ left: -87, top: -192 });
  await view.unmount();
});

test('swiping down returns once, and unmount cancels pending completion', async () => {
  const view = await detail();
  await act(async () => jest.advanceTimersByTime(540));
  const layer = view.getByTestId('chip-detail-layer');
  await fireEvent(layer, 'touchStart', { nativeEvent: { pageY: 200 } });
  await fireEvent(layer, 'touchEnd', { nativeEvent: { pageY: 250 } });
  await fireEvent.press(view.getByRole('button', { name: 'Close color detail' }));
  await view.unmount();
  await act(async () => jest.advanceTimersByTime(1000));
  expect(onClose).not.toHaveBeenCalled();
});

test('resizing during return preserves dismissal and uses the latest callback', async () => {
  const view = await detail();
  await act(async () => jest.advanceTimersByTime(540));
  await fireEvent.press(view.getByRole('button', { name: 'Close color detail' }));
  await act(async () => jest.advanceTimersByTime(100));
  const latestClose = jest.fn();
  await view.rerender(<ChipDetail kit={kit} role="primary" slot={slot} origin={{ x: 40, y: 300 }}
    onClose={latestClose} onEdit={onEdit} />);
  await act(async () => jest.advanceTimersByTime(440));
  expect(latestClose).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
});

test('scrolling the detail copy does not trigger swipe dismissal', async () => {
  const view = await detail();
  await act(async () => jest.advanceTimersByTime(540));
  const layer = view.getByTestId('chip-detail-layer');
  await fireEvent(layer, 'touchStart', { nativeEvent: { pageY: 200 } });
  await fireEvent(view.getByTestId('chip-detail-scroll'), 'scrollBeginDrag');
  await fireEvent(layer, 'touchEnd', { nativeEvent: { pageY: 250 } });
  await act(async () => jest.advanceTimersByTime(540));
  expect(onClose).not.toHaveBeenCalled();
  expect(view.getByTestId('chip-detail-toggle')).toBeTruthy();
});
