import { Canvas, useImage } from '@shopify/react-native-skia';
import { render } from '@testing-library/react-native';
import { PaperTexture } from './PaperTexture';

jest.mock('@shopify/react-native-skia', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Canvas: jest.fn((props) => React.createElement(View, props)),
    Fill: ({ children }: { children: React.ReactNode }) => children,
    ImageShader: () => null,
    useImage: jest.fn(() => ({})),
  };
});

test('passes a flat style object to Canvas once the texture loads', async () => {
  await render(<PaperTexture opacity={0.25} />);
  const { style } = jest.mocked(Canvas).mock.calls[0][0];
  expect(Array.isArray(style)).toBe(false);
  expect(style).toEqual({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    mixBlendMode: 'multiply', opacity: 0.25 });
});

test('waits for the texture before rendering Canvas', async () => {
  jest.mocked(useImage).mockReturnValueOnce(null);
  await render(<PaperTexture />);
  expect(Canvas).not.toHaveBeenCalled();
});
