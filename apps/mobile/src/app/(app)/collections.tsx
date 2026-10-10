import type { CollectionSummary } from '@inzpo/shared';
import { router, Stack, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CollectionState } from '@/components/CollectionState';
import { PaperPressable } from '@/components/PaperPressable';
import { INK, fonts } from '@/theme/tokens';
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!focused) return;
    let active = true;
    client.listCollections().then(rows => { if (active) { setCollections(rows); setError(false); } })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, [client, focused, attempt]);
  return <SafeAreaView style={ui.screen} edges={['left', 'right', 'bottom']}>
    <Stack.Screen options={{ title: 'Your inspiration' }} />
    <PaperTexture />
    <FlatList testID="collections-list" refreshing={refreshing} onRefresh={() => { setRefreshing(true); setAttempt(v => v + 1); }} data={collections ?? []} keyExtractor={item => item.id} contentContainerStyle={ui.content}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 20 }}>
        <Text accessibilityRole="header" style={ui.heading}>Ideas worth keeping.</Text>
        <Text style={ui.body}>A little color for whatever comes next.</Text>
        {error && <><Text accessibilityRole="alert" style={ui.body}>Couldn’t load your collections.</Text>
          <ActionButton label={refreshing ? 'Refreshing…' : 'Try again'} disabled={refreshing} onPress={() => { setRefreshing(true); setAttempt(v => v + 1); }} /></>}
        {!collections && !error && <CollectionState title="Opening your inspiration" message="A place for the colors you notice." busy />}
      </View>}
      ListEmptyComponent={collections && !error ? <CollectionState title="Your next idea starts here" message="Your first bit of inspiration is one photo away."
        action="Take a photo" onAction={() => router.dismissTo('/')} /> : null}
      renderItem={({ item }) => <PaperPressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.count} kits`}
        onPress={() => router.push({ pathname: '/collection/[id]', params: { id: item.id } })}
        style={[stockSurface, { padding: 22, paddingTop: 30, marginBottom: 20, marginTop: 12, minHeight: 132, borderRadius: 3 }]}>
        <View accessible={false} style={{ position: 'absolute', top: -12, left: 12, width: 94, height: 18, backgroundColor: '#E4D9C6', borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
        <PaperTexture />
        <Text style={[ui.heading, { fontSize: 29, lineHeight: 36, marginBottom: 8 }]}>{item.name}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={ui.body}>{item.count} {item.count === 1 ? 'kit' : 'kits'}</Text>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: INK }}>Open collection</Text>
        </View>
      </PaperPressable>} />
  </SafeAreaView>;
}
