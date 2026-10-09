import { act, render } from '@testing-library/react-native';
import { ChewingCaption } from './ChewingCaption';

afterEach(() => jest.useRealTimers());

test('the exact chewing copy appears after two seconds and unmount cancels it', async () => {
  jest.useFakeTimers();
  const view = await render(<ChewingCaption />);
  expect(view.queryByText('Chewing on it.')).toBeNull();
  await act(async () => jest.advanceTimersByTime(1999));
  expect(view.queryByText('Chewing on it.')).toBeNull();
  await act(async () => jest.advanceTimersByTime(1));
  expect(view.getByText('Chewing on it.')).toBeVisible();
  await view.unmount();
  const clear = jest.spyOn(global, 'clearTimeout');
  const fast = await render(<ChewingCaption />);
  await fast.unmount();
  expect(clear).toHaveBeenCalled();
  clear.mockRestore();
});
