import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { PAPER } from '@/theme/tokens';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: PAPER } }} />;
}
