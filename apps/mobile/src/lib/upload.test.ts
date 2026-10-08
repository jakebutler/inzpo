import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { mockClient } from '../../tests/fixtures';
import { uploadPhoto } from './upload';

const originalFetch = global.fetch;
const body = new ArrayBuffer(1234);
const photo = { uri: 'file:///source.heic', width: 4096, height: 3072, fileName: 'House.HEIC' };
let client: ReturnType<typeof mockClient>;
const rendered = { saveAsync: jest.fn(), release: jest.fn() };
const context = { resize: jest.fn(), renderAsync: jest.fn(), release: jest.fn() };

beforeEach(() => {
  client = mockClient();
  rendered.saveAsync.mockResolvedValue({ uri: 'file:///house.jpg', width: 2048, height: 1536 });
  context.renderAsync.mockResolvedValue(rendered);
  jest.mocked(ImageManipulator.manipulate).mockReturnValue(context as unknown as ReturnType<typeof ImageManipulator.manipulate>);
  global.fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => body } as Response));
});
afterEach(() => { global.fetch = originalFetch; });

test('normalizes JPEG then presigns, PUTs, and creates the kit in order', async () => {
  const order: string[] = [];
  const presign = { url: 'https://uploads.example/put', key: 'upload-1', contentType: 'image/jpeg' };
  client.presignUpload.mockImplementation(async () => { order.push('presign'); return presign; });
  client.uploadToPresignedUrl.mockImplementation(async () => { order.push('PUT'); });
  client.createKit.mockImplementation(async () => { order.push('createKit'); return { itemId: 'kit-1' }; });
  await expect(uploadPhoto(client, photo)).resolves.toBe('kit-1');
  expect(ImageManipulator.manipulate).toHaveBeenCalledWith(photo.uri);
  expect(context.resize).toHaveBeenCalledWith({ width: 2048 });
  expect(rendered.saveAsync).toHaveBeenCalledWith({ format: SaveFormat.JPEG, compress: 0.85 });
  expect(global.fetch).toHaveBeenCalledWith('file:///house.jpg');
  expect(client.presignUpload).toHaveBeenCalledWith({ contentType: 'image/jpeg', bytes: 1234 });
  expect(client.uploadToPresignedUrl).toHaveBeenCalledWith(presign, body);
  expect(client.createKit).toHaveBeenCalledWith({ uploadKey: 'upload-1', filename: 'House.jpg' });
  expect(order).toEqual(['presign', 'PUT', 'createKit']);
  expect(rendered.release).toHaveBeenCalledTimes(1);
  expect(context.release).toHaveBeenCalledTimes(1);
});

test('uses height for portrait photos and does not upscale small ones', async () => {
  await uploadPhoto(client, { ...photo, width: 2000, height: 4000 });
  expect(context.resize).toHaveBeenCalledWith({ height: 2048 });
  context.resize.mockClear();
  await uploadPhoto(client, { ...photo, width: 800, height: 600 });
  expect(context.resize).not.toHaveBeenCalled();
});

test('does not create a kit when the PUT fails', async () => {
  client.uploadToPresignedUrl.mockRejectedValue(new Error('offline'));
  await expect(uploadPhoto(client, photo)).rejects.toThrow('offline');
  expect(client.createKit).not.toHaveBeenCalled();
  expect(context.release).toHaveBeenCalled();
});

test('rejects an oversized JPEG before requesting a presign', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8 * 1024 * 1024 + 1) } as Response));
  await expect(uploadPhoto(client, photo)).rejects.toThrow('Invalid photo size');
  expect(client.presignUpload).not.toHaveBeenCalled();
});
