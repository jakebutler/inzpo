import { act, renderHook } from '@testing-library/react-native';
import { InzpoApiError } from '@inzpo/shared';
import { kitFixture, mockClient } from '../../tests/fixtures';
import { useInzpoClient } from './api';
import { useKit } from './use-kit';

jest.mock('./api', () => ({ useInzpoClient: jest.fn() }));
let client: ReturnType<typeof mockClient>;
beforeEach(() => {
  client = mockClient();
  jest.mocked(useInzpoClient).mockReturnValue(client);
});

test('a changed client keeps the kit visible and does not refetch; retry uses the latest client', async () => {
  const hook = await renderHook(() => useKit('kit-1'));
  expect(hook.result.current.kit).toEqual(kitFixture);
  const next = mockClient();
  let resolve!: (kit: typeof kitFixture) => void;
  next.getKit.mockReturnValue(new Promise((done) => { resolve = done; }));
  jest.mocked(useInzpoClient).mockReturnValue(next);
  await hook.rerender({});
  expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.kit).toEqual(kitFixture);
  expect(client.getKit).toHaveBeenCalledTimes(1);
  expect(next.getKit).not.toHaveBeenCalled();
  await act(async () => hook.result.current.retry());
  expect(next.getKit).toHaveBeenCalledTimes(1);
  expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.kit).toEqual(kitFixture);
  await act(async () => resolve({ ...kitFixture, title: 'Refreshed' }));
  expect(hook.result.current.kit?.title).toBe('Refreshed');
});

test('failed retry retains the kit and brief failure, but a new route cannot display the old kit', async () => {
  client.getKit.mockResolvedValueOnce({ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending' } });
  client.getBrief.mockRejectedValue(new Error('offline'));
  const hook = await renderHook(({ id }: { id: string }) => useKit(id), { initialProps: { id: 'kit-1' } });
  expect(hook.result.current.briefFailed).toBe(true);
  client.getKit.mockRejectedValueOnce(new Error('offline'));
  await act(async () => hook.result.current.retry());
  expect(hook.result.current.kit?.id).toBe('kit-1');
  expect(hook.result.current.briefFailed).toBe(true);
  expect(hook.result.current.loading).toBe(false);
  client.getKit.mockRejectedValueOnce(new InzpoApiError(404, 'not found'));
  await hook.rerender({ id: 'kit-2' });
  expect(hook.result.current.kit).toBeNull();
  expect(hook.result.current.error).toBe('notFound');
});

test('aborted polling cannot update another route and replaceKit only accepts the current kit', async () => {
  client.getKit.mockResolvedValueOnce({ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending' } });
  let resolve!: (brief: typeof kitFixture.brief) => void;
  client.getBrief.mockReturnValue(new Promise((done) => { resolve = done; }));
  const hook = await renderHook(({ id }: { id: string }) => useKit(id), { initialProps: { id: 'kit-1' } });
  const oldReplace = hook.result.current.replaceKit;
  client.getKit.mockResolvedValue({ ...kitFixture, id: 'kit-2', title: 'Second' });
  await hook.rerender({ id: 'kit-2' });
  await act(async () => resolve(kitFixture.brief));
  await act(async () => hook.result.current.replaceKit(kitFixture));
  expect(hook.result.current.kit?.title).toBe('Second');
  await act(async () => hook.result.current.replaceKit({ ...kitFixture, id: 'kit-2', title: 'Edited' }));
  await act(async () => oldReplace(kitFixture));
  expect(hook.result.current.kit?.title).toBe('Edited');
});

test.each(['retry', 'brief refresh'])('an in-flight %s cannot overwrite edited colors', async (source) => {
  if (source === 'brief refresh') {
    client.getKit.mockResolvedValueOnce({ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending' } });
  }
  let resolve!: (kit: typeof kitFixture) => void;
  if (source === 'brief refresh') {
    client.getKit.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  }
  const hook = await renderHook(() => useKit('kit-1'));
  if (source === 'retry') {
    client.getKit.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await act(async () => hook.result.current.retry());
  }
  const edited = { ...kitFixture, roles: { ...kitFixture.roles, accent: '#123456' } };
  await act(async () => hook.result.current.replaceKit(edited));
  await act(async () => resolve(kitFixture));
  expect(hook.result.current.kit?.roles.accent).toBe('#123456');
  expect(hook.result.current.loading).toBe(false);
});

test.each(['pending', 'ready'] as const)('older %s retry and edit responses retain a resolved brief', async (status) => {
  const pending = { ...kitFixture, brief: { ...kitFixture.brief, status, updatedAt: 0 } };
  const hook = await renderHook(() => useKit('kit-1'));
  await act(async () => hook.result.current.replaceKit(pending));
  expect(hook.result.current.kit?.brief).toEqual(kitFixture.brief);
  client.getKit.mockResolvedValueOnce(pending);
  client.getBrief.mockReturnValue(new Promise(() => {}));
  await act(async () => hook.result.current.retry());
  expect(hook.result.current.kit?.brief).toEqual(kitFixture.brief);
  await hook.unmount();
});

test('editing after a polling failure retains the visible fallback while the brief is pending', async () => {
  const pending = { ...kitFixture, brief: { ...kitFixture.brief, status: 'pending' as const } };
  client.getKit.mockResolvedValueOnce(pending);
  client.getBrief.mockRejectedValue(new Error('offline'));
  const hook = await renderHook(() => useKit('kit-1'));
  expect(hook.result.current.briefFailed).toBe(true);
  await act(async () => hook.result.current.replaceKit(pending));
  expect(hook.result.current.briefFailed).toBe(true);
});

test('an older poll and refresh cannot replace a newer brief returned by Edit', async () => {
  client.getKit.mockResolvedValueOnce({ ...kitFixture, brief: { ...kitFixture.brief, status: 'pending', updatedAt: 0 } });
  let resolve!: (brief: typeof kitFixture.brief) => void;
  client.getBrief.mockReturnValue(new Promise((done) => { resolve = done; }));
  const hook = await renderHook(() => useKit('kit-1'));
  const edited = { ...kitFixture, brief: { ...kitFixture.brief, text: 'New brief', updatedAt: 3 } };
  await act(async () => hook.result.current.replaceKit(edited));
  await act(async () => resolve(kitFixture.brief));
  expect(client.getKit).toHaveBeenCalledTimes(2);
  expect(hook.result.current.kit?.brief).toEqual(edited.brief);
});
