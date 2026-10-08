import { useAuth, useClerk, useSignIn } from '@clerk/expo';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { Baku } from '@/components/Baku';
import { AUTH_RETRY_MESSAGE, authErrorMessage } from '@/lib/auth-errors';
import { ui } from '@/theme/styles';
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
          <Baku pose="idle" />
          <Text style={ui.heading}>Snap a house. Keep its colors.</Text>
          <Text style={ui.body}>Enter your email and we&apos;ll send you a code.</Text>
          {codeSent ? (
            <View style={{ gap: 12 }}>
              <Text style={ui.body}>{`Code sent to ${email.trim()}.`}</Text>
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
