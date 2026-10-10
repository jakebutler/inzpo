import { beginCapture, captureSnapshot, runCapture } from './capture-session';
import { uploadPhoto } from './upload';
import { mockClient } from '../../tests/fixtures';
jest.mock('./api', () => ({ useInzpoClient: jest.fn() }));
jest.mock('./upload', () => ({ uploadPhoto: jest.fn() }));
const photo = { uri: 'file:///dedup.jpg', width: 1000, height: 1500 };

test('subscriptions and remounts cannot duplicate an in-flight or successful capture', async () => {
  const id = beginCapture(photo), client = mockClient();
  let resolve!: (id: string) => void;
  jest.mocked(uploadPhoto).mockReturnValue(new Promise(done => { resolve = done; }));
  const first = runCapture(id, client);
  expect(runCapture(id, client)).toBe(first);
  expect(runCapture(id, client, true)).toBe(first);
  expect(uploadPhoto).toHaveBeenCalledTimes(1);
  resolve('deduplicated-kit'); await first;
  await runCapture(id, client, true);
  expect(uploadPhoto).toHaveBeenCalledTimes(1);
  expect(captureSnapshot(id)).toMatchObject({ kitId: 'deduplicated-kit', error: false });
});

test('a failure only retries explicitly and retains the photo with each phase', async () => {
  const id = beginCapture(photo), client = mockClient();
  jest.mocked(uploadPhoto).mockRejectedValueOnce(new Error('offline'));
  await runCapture(id, client);
  expect(captureSnapshot(id)).toMatchObject({ error: true, photo: { url: photo.uri } });
  await runCapture(id, client);
  expect(uploadPhoto).toHaveBeenCalledTimes(1);
  jest.mocked(uploadPhoto).mockImplementation(async (_client, _photo, processing) => {
    expect(captureSnapshot(id)).toMatchObject({ phase: 'keeping', error: false });
    processing?.();
    expect(captureSnapshot(id)?.phase).toBe('processing');
    return 'retried-kit';
  });
  await runCapture(id, client, true);
  expect(uploadPhoto).toHaveBeenCalledTimes(2);
  expect(captureSnapshot(id)).toMatchObject({ kitId: 'retried-kit', error: false });
});
