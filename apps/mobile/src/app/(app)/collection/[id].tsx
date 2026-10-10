import { InzpoApiError, type MobileCollection } from '@inzpo/shared';
import { router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { BackButton } from '@/components/BackButton';
import { PaperTexture } from '@/components/PaperTexture';
import { CollectionState } from '@/components/CollectionState';
import { CollectionKitCard } from '@/components/CollectionKitCard';
import { useInzpoClient } from '@/lib/api';
import { ui } from '@/theme/styles';

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useInzpoClient();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState<{ id: string; collection?: MobileCollection; error?: string }>();
  useEffect(() => {
    if (!focused || typeof id !== 'string' || !id) return;
    let active = true;
    client.getCollection(id).then(collection => { if (active) setState({ id, collection }); })
      .catch((error: unknown) => { if (active) setState(previous => ({ id, collection: previous?.id === id ? previous.collection : undefined,
        error: error instanceof InzpoApiError && error.status === 404 ? 'This collection couldn’t be found.' : 'Couldn’t load this collection. Please try again.' })); })
      .finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, [client, id, attempt, focused]);
  const current = typeof id !== 'string' || !id ? { error: 'This collection couldn’t be found.', collection: undefined }
    : state?.id === id ? state : undefined;
  const retry = () => { setRefreshing(true); setAttempt(value => value + 1); };
  return <SafeAreaView style={ui.screen} edges={['left', 'right']}>
    <Stack.Screen options={{ headerShown: false }} />
    <PaperTexture />
    <FlatList testID="collection-list" data={current?.collection?.kits ?? []} keyExtractor={kit => kit.id}
      initialNumToRender={6} maxToRenderPerBatch={4} windowSize={5} refreshing={refreshing} onRefresh={retry}
      contentContainerStyle={[ui.content, { gap: 8, paddingTop: Math.max(40, insets.top), paddingBottom: insets.bottom + 24 }]}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 8 }}>
        <BackButton onPress={() => router.canGoBack() ? router.back() : router.dismissTo('/collections')} />
        <Text accessibilityRole="header" style={ui.heading}>{current?.collection?.name ?? 'Your collection'}</Text>
        {current?.collection && <Text style={ui.body}>{current.collection.kits.length} {current.collection.kits.length === 1 ? 'idea' : 'ideas'} waiting for your next project.</Text>}
        {current?.error && <><Text accessibilityRole="alert" style={ui.body}>{current.error}</Text>
          {current.collection && <Text style={ui.label}>Showing the kits already here.</Text>}
          <ActionButton label={refreshing ? 'Refreshing…' : 'Try again'} disabled={refreshing} onPress={retry} /></>}
      </View>}
      ListEmptyComponent={!current ? <CollectionState title="Opening your inspiration" message="Making a little room for your ideas." busy />
        : current.collection?.kits.length === 0 ? <CollectionState title="Room for an idea" message="No kits in this collection yet. Find a color worth keeping."
          action="Take a photo" onAction={() => router.dismissTo('/')} />
        : current.error ? <CollectionState title="A little snag" message="Your inspiration hasn’t gone anywhere. Try loading it again." /> : null}
      renderItem={({ item }) => <CollectionKitCard kit={item} onPress={() => router.push({ pathname: '/kit/[id]', params: { id: item.id } })} />} />
  </SafeAreaView>;
}
