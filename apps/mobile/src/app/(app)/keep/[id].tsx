import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { BackButton } from '@/components/BackButton';
import { KeepScreen, type SavedCollection } from '@/components/KeepScreen';
import { useKit } from '@/lib/use-kit';
import { ui } from '@/theme/styles';

export default function KeepRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { kit, error, retry } = useKit(id);
  const [saved, setSaved] = useState<(SavedCollection & { kitId: string }) | null>(null);
  return <>
    <Stack.Screen options={{ headerShown: false, title: 'Keep this kit' }} />
    {kit ? <KeepScreen key={id} kitId={id} kit={kit}
      onSaved={(collection) => setSaved({ ...collection, kitId: id })}
      onClose={() => {
        if (saved?.kitId === id) router.replace({ pathname: '/kit/[id]', params: { id, saved: '1', c: saved.collectionId } });
        else router.back();
      }} /> : <SafeAreaView style={[ui.screen, ui.content]}>
      <BackButton onPress={() => router.back()} />
      <Text accessibilityRole="header" style={ui.heading}>Keep this kit</Text>
      <Text style={ui.message}>{error ? 'Couldn’t load this kit. Please try again.' : 'Loading your kit…'}</Text>
      {error && <ActionButton label="Try again" onPress={retry} />}
    </SafeAreaView>}
  </>;
}
