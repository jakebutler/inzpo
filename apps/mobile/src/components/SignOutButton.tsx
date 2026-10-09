import { useClerk } from '@clerk/expo';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ui } from '@/theme/styles';

export function SignOutButton() {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function leave() {
    setBusy(true);
    setFailed(false);
    try { await signOut(); } catch { setFailed(true); } finally { setBusy(false); }
  }
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void leave()} hitSlop={12}>
      <Text style={ui.label}>{busy ? 'Signing out…' : failed ? 'Retry sign out' : 'Sign out'}</Text>
    </Pressable>
  );
}
