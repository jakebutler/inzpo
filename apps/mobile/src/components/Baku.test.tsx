import { emptyRoles } from '@inzpo/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react-native';
import { Baku } from './Baku';
import { BAKU_IMAGE_SAMPLING, BAKU_TINT_SKSL } from './BakuTinted';
import { bakuTintAssets } from '@/lib/baku-assets';

const Skia = jest.requireMock<typeof import('@shopify/react-native-skia')>('@shopify/react-native-skia');

function expectColorSprite(view: Awaited<ReturnType<typeof render>>, pose = 'idle') {
  const sprite = view.getByTestId(`baku-${pose}`);
  expect(sprite.type).toBe('Image');
  expect(sprite.props.source).toEqual(expect.objectContaining({
    testUri: expect.stringContaining(`assets/baku-v6/baku-${pose}-color.png`),
  }));
}

afterEach(() => jest.restoreAllMocks());

test('without roles Baku uses the fixed v6 full-color sprite and never loads tint images', async () => {
  const load = jest.spyOn(Skia, 'useImage');
  const view = await render(<Baku />);
  expectColorSprite(view);
  expect(load).not.toHaveBeenCalled();
});

test('loading tint images keeps the full-color sprite visible', async () => {
  jest.spyOn(Skia, 'useImage').mockReturnValue(null);
  const view = await render(<Baku roles={emptyRoles()} />);
  expectColorSprite(view);
});

test('loads the grouped base, shade and masks in stripe order', async () => {
  const load = jest.spyOn(Skia, 'useImage').mockReturnValue(null);
  await render(<Baku pose="chewing" roles={emptyRoles()} />);
  expect(load.mock.calls.slice(0, 8).map(([source]) => source)).toEqual(bakuTintAssets.chewing);
});

test('all eight tint image shaders explicitly use Mitchell cubic sampling', async () => {
  const image = Skia.Skia.Image.MakeImageFromEncoded(Skia.Skia.Data.fromBytes(
    readFileSync(resolve(__dirname, '../../assets/baku-v6/baku-idle@3x.png')),
  ))!;
  jest.spyOn(Skia, 'useImage').mockReturnValue(image);
  const shaders = jest.spyOn(Skia, 'ImageShader');
  await render(<Baku roles={emptyRoles()} />);
  expect(shaders).toHaveBeenCalledTimes(8);
  expect(BAKU_IMAGE_SAMPLING).toEqual({ B: 1 / 3, C: 1 / 3 });
  for (const [props] of shaders.mock.calls) expect(props.sampling).toEqual(BAKU_IMAGE_SAMPLING);
  image.dispose();
});

test('the actual SkSL compiles with tint, wipe and pupil uniforms', () => {
  const effect = Skia.Skia.RuntimeEffect.Make(BAKU_TINT_SKSL);
  expect(effect).not.toBeNull();
  expect(effect!.getUniformCount()).toBe(15);
  expect(effect!.getUniformFloatCount()).toBe(56);
});

test.each(['null', 'throws'])('an unavailable RuntimeEffect (%s) uses the full-color fallback', async (failure) => {
  jest.spyOn(Skia.Skia.RuntimeEffect, 'Make').mockImplementation(() => {
    if (failure === 'throws') throw new Error('RuntimeEffect unavailable');
    return null;
  });
  let UnavailableTint!: typeof import('./BakuTinted').BakuTinted;
  jest.isolateModules(() => {
    UnavailableTint = jest.requireActual<typeof import('./BakuTinted')>('./BakuTinted').BakuTinted;
  });
  const { Image } = jest.requireMock<typeof import('expo-image')>('expo-image');
  const fallback = <Image source={require('../../assets/baku-v6/baku-idle-color.png')} testID="baku-idle" />;
  const view = await render(<UnavailableTint pose="idle" size={96} roles={emptyRoles()} fallback={fallback} />);
  expectColorSprite(view);
});
