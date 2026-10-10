import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import { Text } from 'react-native';
import { ui } from '@/theme/styles';
import { SignOutButton } from '@/components/SignOutButton';
import { CANVAS, fonts, INK } from '@/theme/tokens';

export default function AppLayout() {
  const reducedMotion = useReducedMotion();
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  return (
    <Stack screenOptions={{
      animation: reducedMotion ? 'fade' : 'default', animationDuration: reducedMotion ? 150 : undefined,
      headerStyle: { backgroundColor: CANVAS }, headerTintColor: INK,
      headerTitleStyle: { fontFamily: fonts.heading, fontSize: 22 },
      headerTitle: ({ children }) => <Text allowFontScaling style={ui.headerTitle}>{children}</Text>, headerShadowVisible: false,
      headerRight: () => <SignOutButton />, contentStyle: { backgroundColor: CANVAS },
    }}>
      <Stack.Screen name="index" options={{ title: 'Inzpo' }} />
      <Stack.Screen name="kit/[id]" options={{ title: 'Your colors' }} />
      <Stack.Screen name="keep/[id]" options={{ title: 'Keep this kit', headerShown: false }} />
    </Stack>
  );
}
