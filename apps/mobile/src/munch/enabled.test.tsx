import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import AppLayout from '@/app/(app)/_layout';
import MunchLabScreen from '@/app/munch-lab';

let mockEnabled = false;
let mockTitle = 'Inzpo';
jest.mock('./enabled', () => ({ get munchLabEnabled() { return mockEnabled; } }));
jest.mock('./MunchLab', () => ({ MunchLab: () => jest.requireActual<typeof import('react')>('react')
  .createElement(jest.requireActual<typeof import('react-native')>('react-native').Text, null, 'lab') }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const Stack = ({ screenOptions }: { screenOptions: { headerTitle: (props: { children: string }) => React.ReactNode } }) =>
    screenOptions.headerTitle({ children: mockTitle });
  Stack.Screen = function MockStackScreen() { return null; };
  return {
    Stack,
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `redirect:${href}`),
    router: { push: jest.fn() },
  };
});

const originalVariant = process.env.EXPO_PUBLIC_APP_VARIANT;
const originalDev = __DEV__;
const devGlobal = global as typeof global & { __DEV__: boolean };
afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  if (originalVariant === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = originalVariant;
});

test.each([
  [true, undefined, true],
  [false, 'preview', true],
  [false, undefined, false],
  [false, 'production', false],
])('bundle gate: dev=%s, variant=%s gives enabled=%s', (dev, variant, expected) => {
  devGlobal.__DEV__ = dev;
  if (variant === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = variant;
  jest.isolateModules(() => {
    // Evaluate the real module with production __DEV__ to catch gates that
    // accidentally depend on EAS_BUILD_PROFILE (absent from Update bundles).
    expect(jest.requireActual<typeof import('./enabled')>('./enabled').munchLabEnabled).toBe(expected);
  });
});

test.each([true, false])('the title only opens the lab on an enabled long press (%s)', async (enabled) => {
  mockEnabled = enabled;
  mockTitle = 'Inzpo';
  const view = await render(<AppLayout />);
  await fireEvent.press(view.getByText('Inzpo'));
  expect(router.push).not.toHaveBeenCalled();
  await fireEvent(view.getByText('Inzpo'), 'longPress');
  expect(router.push).toHaveBeenCalledTimes(enabled ? 1 : 0);
});

test('other screen titles retain their normal behavior even in preview', async () => {
  mockEnabled = true;
  mockTitle = 'Your colors';
  const view = await render(<AppLayout />);
  await fireEvent(view.getByText('Your colors'), 'longPress');
  expect(router.push).not.toHaveBeenCalled();
});

test.each([true, false])('direct route is gated too (%s)', async (enabled) => {
  mockEnabled = enabled;
  const view = await render(<MunchLabScreen />);
  expect(view.getByText(enabled ? 'lab' : 'redirect:/')).toBeTruthy();
});
