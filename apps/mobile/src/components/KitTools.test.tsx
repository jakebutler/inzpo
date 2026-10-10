import { act, fireEvent, render } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { KitTools } from './KitTools';
import { kitFixture } from '../../tests/fixtures';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
jest.mock('expo-file-system', () => ({ Paths: { cache: 'cache/' }, File: jest.fn().mockImplementation(() => ({
  uri: 'file:///kit.css', exists: true, create: jest.fn(), write: jest.fn(), delete: jest.fn(),
})) }));

afterEach(() => jest.useRealTimers());

test('Copy names its active operation, prevents duplicates and only confirms after clipboard success', async () => {
  let finish!: () => void;
  jest.mocked(Clipboard.setStringAsync).mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(true); }));
  const view = await render(<KitTools kit={kitFixture} compact />);
  await fireEvent.press(view.getByRole('button', { name: 'Copy kit' }));
  expect(view.getByRole('button', { name: 'Copying…' })).toBeDisabled();
  expect(view.getByRole('button', { name: 'Export CSS' })).toBeDisabled();
  expect(view.queryByText('Kit copied. Make something with it.')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Copying…' }));
  expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(view.getByRole('button', { name: 'Copied' })).toBeEnabled();
  expect(view.getByText('Kit copied. Make something with it.')).toBeTruthy();
});

test.each([false, true])('pending copy remains truthful when polling failed: %s', async failed => {
  const view = await render(<KitTools kit={{ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending', text: null } }} descriptionFailed={failed} />);
  await fireEvent.press(view.getByRole('button', { name: 'Copy kit' }));
  expect(view.getByText(failed ? 'Colors copied. The description is unavailable.' : 'Colors copied. The description is still on its way.')).toBeTruthy();
});

test('clipboard failure identifies copying and leaves retry available', async () => {
  jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error('clipboard'));
  const view = await render(<KitTools kit={kitFixture} />);
  await fireEvent.press(view.getByRole('button', { name: 'Copy kit' }));
  expect(view.getByText('Couldn’t copy this kit. Please try again.')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Copy kit' })).toBeEnabled();
  expect(view.queryByText('Kit copied. Make something with it.')).toBeNull();
});

test('dismissing native sharing clears progress and temporary file without claiming delivery', async () => {
  let finish!: () => void;
  jest.mocked(Sharing.shareAsync).mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(); }));
  const view = await render(<KitTools kit={kitFixture} />);
  await fireEvent.press(view.getByRole('button', { name: 'Export CSS' }));
  expect(view.getByRole('button', { name: 'Preparing CSS…' })).toBeDisabled();
  await act(async () => finish());
  expect(view.getByRole('button', { name: 'Export CSS' })).toBeEnabled();
  expect(view.queryByText(/exported|shared|copied/i)).toBeNull();
  const file = jest.mocked(File).mock.results.at(-1)?.value;
  expect(file.write).toHaveBeenCalledWith(expect.stringContaining('--color-primary: #b35831'));
  expect(file.delete).toHaveBeenCalledTimes(1);
});
