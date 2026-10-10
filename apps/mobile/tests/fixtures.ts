import { type InzpoClient, type MobileKit } from '@inzpo/shared';

export const kitFixture: MobileKit = {
  id: 'kit-1', title: 'A quiet house',
  photo: { url: 'https://photos.example/house.jpg', width: 1600, height: 1200, placeholder: null },
  roles: {
    primary: '#b35831', secondary: '#615343', accent: null,
    background: '#f3eee4', surface: '#ded5c5', text: '#1c1b19',
  },
  colors: [
    { role: 'primary', hex: '#b35831', name: null, origin: 'region', pinX: .22, pinY: .46 },
    { role: 'secondary', hex: '#615343', name: null, origin: 'region', pinX: .68, pinY: .27 },
    { role: 'background', hex: '#f3eee4', name: null, origin: 'region', pinX: .74, pinY: .58 },
    { role: 'surface', hex: '#ded5c5', name: null, origin: 'region', pinX: .46, pinY: .60 },
    { role: 'text', hex: '#1c1b19', name: null, origin: 'region', pinX: .32, pinY: .18 },
  ], collectionIds: [],
  brief: { status: 'ready', text: 'Warm brick with a quiet, creamy trim.', namedHexes: [], namedColors: [], stub: false, updatedAt: 1 },
};

export function mockClient(): jest.Mocked<InzpoClient> {
  return {
    presignUpload: jest.fn<ReturnType<InzpoClient['presignUpload']>, Parameters<InzpoClient['presignUpload']>>()
      .mockResolvedValue({ url: 'https://uploads.example/put', key: 'upload-1', contentType: 'image/jpeg' }),
    uploadToPresignedUrl: jest.fn<ReturnType<InzpoClient['uploadToPresignedUrl']>, Parameters<InzpoClient['uploadToPresignedUrl']>>()
      .mockResolvedValue(undefined),
    createKit: jest.fn<ReturnType<InzpoClient['createKit']>, Parameters<InzpoClient['createKit']>>()
      .mockResolvedValue({ itemId: 'kit-1' }),
    updateKitColors: jest.fn<ReturnType<InzpoClient['updateKitColors']>, Parameters<InzpoClient['updateKitColors']>>()
      .mockImplementation(async (_id, input) => ({ ...kitFixture, roles: { ...kitFixture.roles, ...input.roles } })),
    getKit: jest.fn<ReturnType<InzpoClient['getKit']>, Parameters<InzpoClient['getKit']>>()
      .mockResolvedValue(kitFixture),
    getBrief: jest.fn<ReturnType<InzpoClient['getBrief']>, Parameters<InzpoClient['getBrief']>>()
      .mockResolvedValue(kitFixture.brief),
    runBrief: jest.fn<ReturnType<InzpoClient['runBrief']>, Parameters<InzpoClient['runBrief']>>()
      .mockResolvedValue(kitFixture.brief),
    listCollections: jest.fn(async () => [{ id: 'collection-1', name: 'Neighborhood', count: 2 }]),
    getCollection: jest.fn<ReturnType<InzpoClient['getCollection']>, Parameters<InzpoClient['getCollection']>>()
      .mockResolvedValue({ id: 'collection-1', name: 'Neighborhood', kits: [kitFixture] }),
    saveKit: jest.fn<ReturnType<InzpoClient['saveKit']>, Parameters<InzpoClient['saveKit']>>()
      .mockResolvedValue({ collectionId: 'collection-1' }),
  };
}
