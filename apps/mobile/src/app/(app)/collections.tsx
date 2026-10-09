import type { CollectionSummary } from '@inzpo/shared';
import { router, Stack, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { PaperTexture } from '@/components/PaperTexture';
import { useInzpoClient } from '@/lib/api';
import { stockSurface } from '@/theme/materials';
import { ui } from '@/theme/styles';

export default function CollectionsScreen() {
  const client = useInzpoClient();
  const focused = useIsFocused();
  const [attempt, setAttempt] = useState(0);
  const [collections, setCollections] = useState<CollectionSummary[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    client.listCollections().then(rows => { if (active) { setCollections(rows); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [client, focused, attempt]);
  return <SafeAreaView style={ui.screen} edges={['left', 'right', 'bottom']}>
    <Stack.Screen options={{ title: 'Your inspiration' }} />
    <PaperTexture />
    <FlatList data={collections ?? []} keyExtractor={item => item.id} contentContainerStyle={ui.content}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 20 }}>
        <Text accessibilityRole="header" style={ui.heading}>Ideas worth keeping.</Text>
        <Text style={ui.body}>A little color for whatever comes next.</Text>
        {error && <><Text accessibilityRole="alert" style={ui.body}>Couldn’t load your collections.</Text>
          <ActionButton label="Try again" onPress={() => { setError(false); setAttempt(v => v + 1); }} /></>}
        {!collections && !error && <Text style={ui.body}>Opening your collection…</Text>}
      </View>}
      ListEmptyComponent={collections && !error ? <View style={{ gap: 20 }}>
        <Text style={ui.body}>Your first bit of inspiration is one photo away.</Text>
        <ActionButton label="Take a photo" primary onPress={() => router.dismissTo('/')} />
      </View> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.count} kits`}
        onPress={() => router.push({ pathname: '/collection/[id]', params: { id: item.id } })}
        style={({ pressed }) => [stockSurface, { padding: 24, marginBottom: 14, minHeight: 100, opacity: pressed ? .8 : 1 }]}>
        <PaperTexture />
        <Text style={ui.heading}>{item.name}</Text>
        <Text style={ui.body}>{item.count} {item.count === 1 ? 'kit' : 'kits'}</Text>
      </Pressable>} />
  </SafeAreaView>;
}
