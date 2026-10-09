import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useFonts } from '@expo-google-fonts/akaya-kanadaka/useFonts';
import { AkayaKanadaka_400Regular } from '@expo-google-fonts/akaya-kanadaka/400Regular';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InzpoClientProvider } from '@/lib/api';
import { ui } from '@/theme/styles';
import { PAPER } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function StartupError({ message }: { message: string }) {
  useEffect(() => { SplashScreen.hide(); }, []);
  return (
    <View style={[ui.screen, ui.center]}>
      <Text style={ui.heading}>Inzpo needs a little setup.</Text>
      <Text style={ui.body}>{message}</Text>
    </View>
  );
}

function ReadyApp() {
  const { isLoaded } = useAuth();
  useEffect(() => { if (isLoaded) SplashScreen.hide(); }, [isLoaded]);
  if (!isLoaded) return null;
  return (
    <InzpoClientProvider>
      {/* The modal portal host must inherit Clerk and the API client too. */}
      <BottomSheetModalProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: PAPER } }} />
      </BottomSheetModalProvider>
    </InzpoClientProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AkayaKanadaka_400Regular, Geist_400Regular, Geist_500Medium, GeistMono_400Regular,
  });
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={ui.screen}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {fontError ? (
          <StartupError message="The fonts couldn’t load. Please restart Inzpo." />
        ) : !publishableKey ? (
          <StartupError message="Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add it to apps/mobile/.env.local, then restart Expo." />
        ) : (
          <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
            <ReadyApp />
          </ClerkProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
