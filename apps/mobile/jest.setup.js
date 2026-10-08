require('react-native-gesture-handler/jestSetup');

// Use the mocks shipped by the installed Reanimated/Worklets versions.
// Reanimated 4.5.1 predates the new jest/resolver shown in the latest docs.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-reanimated').setUpTests();

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }) => children,
}));
jest.mock('@clerk/expo', () => ({
  ClerkProvider: ({ children }) => children,
  useAuth: jest.fn(() => ({ isLoaded: true, isSignedIn: true, getToken: jest.fn(async () => 'test-token') })),
  useClerk: jest.fn(() => ({ setActive: jest.fn(), signOut: jest.fn() })),
  useSignIn: jest.fn(),
}));
jest.mock('@clerk/expo/token-cache', () => ({ tokenCache: {} }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-image', () => ({ Image: require('react-native').Image }));
jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
  loadAsync: jest.fn(async () => undefined),
  isLoaded: jest.fn(() => true),
  isLoading: jest.fn(() => false),
  getLoadedFonts: jest.fn(() => []),
}));
jest.mock('@expo-google-fonts/fraunces/useFonts', () => ({ useFonts: require('expo-font').useFonts }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hide: jest.fn(),
}));
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Stack = ({ children }) => children;
  Stack.Screen = () => null;
  return {
    Stack,
    Redirect: ({ href }) => React.createElement(Text, null, `redirect:${href}`),
    router: { push: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({ id: 'kit-1' })),
  };
});
