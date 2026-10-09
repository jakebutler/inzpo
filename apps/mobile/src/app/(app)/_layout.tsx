import { useAuth } from '@clerk/expo';
import { Redirect, router, Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { munchLabEnabled } from '@/munch/enabled';
import { ui } from '@/theme/styles';
import { SignOutButton } from '@/components/SignOutButton';
import { fonts, INK, PAPER } from '@/theme/tokens';

export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: PAPER }, headerTintColor: INK,
      headerTitleStyle: { fontFamily: fonts.heading, fontSize: 22 },
      headerTitle: ({ children }) => munchLabEnabled && children === 'Inzpo' ? (
        <Pressable onLongPress={() => router.push('/munch-lab')} delayLongPress={700} accessibilityLabel="Inzpo" accessibilityHint="Long press to open the developer munch lab">
          <Text allowFontScaling style={ui.headerTitle}>{children}</Text>
        </Pressable>
      ) : <Text allowFontScaling style={ui.headerTitle}>{children}</Text>, headerShadowVisible: false,
      headerRight: () => <SignOutButton />, contentStyle: { backgroundColor: PAPER },
    }}>
      <Stack.Screen name="index" options={{ title: 'Inzpo' }} />
      <Stack.Screen name="kit/[id]" options={{ title: 'Your colors' }} />
    </Stack>
  );
}
