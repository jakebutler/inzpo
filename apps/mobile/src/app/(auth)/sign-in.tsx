import { useAuth, useClerk, useSignIn } from '@clerk/expo';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { AUTH_RETRY_MESSAGE, authErrorMessage } from '@/lib/auth-errors';
import { ui } from '@/theme/styles';
import { shade } from '@/theme/buttons';
import { restingBakuSize } from '@/theme/sign-in';
import { INK, fonts } from '@/theme/tokens';

export default function SignInScreen() {
  const { signIn } = useSignIn();
  const { isLoaded } = useAuth();
  const { setActive } = useClerk();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [resent, setResent] = useState(false);
  const [keyboardShown, setKeyboardShown] = useState(Keyboard.isVisible());
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const restingSize = restingBakuSize(width);
  const bakuSize = useSharedValue(restingSize);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardShown(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    bakuSize.set(withTiming(keyboardShown ? 96 : restingSize, { duration: reducedMotion ? 0 : 220 }));
    return () => cancelAnimation(bakuSize);
  }, [keyboardShown, restingSize, reducedMotion, bakuSize]);
  const bakuSlotStyle = useAnimatedStyle(() => ({ width: bakuSize.value, height: bakuSize.value }));
  const bakuSpriteStyle = useAnimatedStyle(() => ({ transform: [{ scale: bakuSize.value / 224 }] }));
  useEffect(() => {
    if (!resent) return;
    const timer = setTimeout(() => setResent(false), 4000);
    return () => clearTimeout(timer);
  }, [resent]);

  async function resend() {
    if (!isLoaded || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      // No identifier: Core 3 reuses the address on the existing sign-in.
      const result = await signIn.emailCode.sendCode();
      if (result.error) throw result.error;
      setCode('');
      setResent(true);
    } catch (failure) { setError(authErrorMessage(failure)); }
    finally { inFlight.current = false; setBusy(false); }
  }

  // Invite-only sign-in. Deliberately do not transfer unknown emails to sign-up.
  // Core 3 exposes emailCode.sendCode/verifyCode; methods return { error }.
  async function submit() {
    if (!isLoaded || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!codeSent) {
        const result = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
        if (result.error) throw result.error;
        setCodeSent(true);
      } else {
        const result = await signIn.emailCode.verifyCode({ code });
        if (result.error) throw result.error;
        if (signIn.status !== 'complete' || !signIn.createdSessionId) {
          setError(AUTH_RETRY_MESSAGE);
          return;
        }
        await setActive({ session: signIn.createdSessionId });
        // The auth layout redirects once Clerk's active session updates.
      }
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function changeEmail() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await signIn.reset();
      if (result.error) throw result.error;
      setCodeSent(false);
      setResent(false);
      setCode('');
      setError(null);
    } catch (failure) { setError(authErrorMessage(failure)); }
    finally { inFlight.current = false; setBusy(false); }
  }

  const canSubmit = codeSent ? code.length === 6 : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <SafeAreaView style={ui.screen}>
      <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[ui.content, { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled">
          <Animated.View testID="sign-in-baku-slot" style={bakuSlotStyle}>
            <Animated.View style={[{ position: 'absolute', width: 224, height: 224, transformOrigin: 'top left' }, bakuSpriteStyle]}>
              <Image testID="baku-idle" source={require('../../../assets/baku-performance/neutral-monotone.webp')} contentFit="contain"
                accessible={false} style={{ width: 224, height: 224 }} />
            </Animated.View>
          </Animated.View>
          <Text style={ui.heading}>Steal the colors off anything</Text>
          <Text style={[ui.body, { color: shade(INK, 0.28) }]}>
            {codeSent ? <>We sent a 6-digit code to <Text style={{ fontFamily: fonts.bodyMedium, color: INK }}>{email.trim()}</Text>.</> : "Enter your email and we'll send you a code."}
          </Text>
          {codeSent ? (
            <View style={{ gap: 12 }}>
              <TextInput
                key="code"
                accessibilityLabel="6-digit code"
                placeholder="000000"
                placeholderTextColor={INK}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
                editable={!busy}
                style={[ui.input, { fontFamily: fonts.mono, letterSpacing: 6 }]}
              />
              {resent ? (
                <Text accessibilityLiveRegion="polite" role="status" style={[ui.body, { minHeight: 44, paddingVertical: 10 }]}>New code sent.</Text>
              ) : (
                <Pressable accessibilityRole="link" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void resend()} style={{ minHeight: 44, justifyContent: 'center', opacity: busy ? 0.4 : 1 }}>
                  <Text style={[ui.body, { textDecorationLine: 'underline' }]}>Didn’t get it? Send a new code.</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <TextInput
              key="email"
              accessibilityLabel="Email"
              placeholder="Email address"
              placeholderTextColor={INK}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="go"
              editable={!busy}
              onSubmitEditing={() => { if (canSubmit) void submit(); }}
              style={ui.input}
            />
          )}
          {error && <Text accessibilityRole="alert" style={ui.body}>{error}</Text>}
          <ActionButton label={busy ? 'One moment…' : codeSent ? 'Verify code' : 'Send code'} primary disabled={!isLoaded || busy || !canSubmit} onPress={() => void submit()} />
          {codeSent && <ActionButton label="Use a different email" disabled={busy} onPress={() => void changeEmail()} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
