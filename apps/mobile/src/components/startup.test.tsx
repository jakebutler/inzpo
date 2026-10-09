import { useAuth } from '@clerk/expo';
import { render } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import RootLayout from '@/app/_layout';

const originalKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
afterEach(() => {
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = originalKey;
});
beforeEach(() => {
  jest.mocked(useFonts).mockReturnValue([true, null]);
  jest.mocked(useAuth).mockReturnValue({ isLoaded: true, isSignedIn: true, getToken: jest.fn() } as unknown as ReturnType<typeof useAuth>);
});

test('missing Clerk key renders a clear setup screen and releases the splash', async () => {
  delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const view = await render(<RootLayout />);
  expect(view.getByText('Inzpo needs a little setup.')).toBeTruthy();
  expect(view.getByText(/Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/)).toBeTruthy();
  expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
});

test('splash waits for fonts, then for Clerk to load', async () => {
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
  jest.mocked(useFonts).mockReturnValue([false, null]);
  jest.mocked(useAuth).mockReturnValue({ isLoaded: false } as ReturnType<typeof useAuth>);
  const view = await render(<RootLayout />);
  expect(SplashScreen.hide).not.toHaveBeenCalled();
  jest.mocked(useFonts).mockReturnValue([true, null]);
  await view.rerender(<RootLayout />);
  expect(SplashScreen.hide).not.toHaveBeenCalled();
  jest.mocked(useAuth).mockReturnValue({ isLoaded: true, isSignedIn: true, getToken: jest.fn() } as unknown as ReturnType<typeof useAuth>);
  await view.rerender(<RootLayout />);
  expect(SplashScreen.hide).toHaveBeenCalledTimes(1);
});


test('loads Akaya for display text and Geist for all body variants, without Fraunces', async () => {
  await render(<RootLayout />);
  const loaded = jest.mocked(useFonts).mock.calls[0][0];
  expect(Object.keys(loaded)).toEqual(['AkayaKanadaka_400Regular', 'Geist_400Regular', 'Geist_500Medium', 'GeistMono_400Regular']);
});
