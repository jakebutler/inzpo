import { COLOR_ROLES, InzpoApiError, type MobileCollection } from '@inzpo/shared';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { ActionButton } from '@/components/ActionButton';
import { BackButton } from '@/components/BackButton';
import { PaperTexture } from '@/components/PaperTexture';
import { useInzpoClient } from '@/lib/api';
import { stockSurface } from '@/theme/materials';
import { fonts, INK } from '@/theme/tokens';
import { ui } from '@/theme/styles';

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useInzpoClient();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ id: string; attempt: number; collection?: MobileCollection; error?: string }>();
  useEffect(() => {
    let active = true;
    if (typeof id !== 'string' || !id) return;
    client.getCollection(id).then((collection) => { if (active) setState({ id, attempt, collection }); })
      .catch((error: unknown) => { if (active) setState({ id, attempt, error: error instanceof InzpoApiError && error.status === 404
        ? 'This collection couldn’t be found.' : 'Couldn’t load this collection. Please try again.' }); });
    return () => { active = false; };
  }, [client, id, attempt]);
  const current = typeof id !== 'string' || !id ? { error: 'This collection couldn’t be found.', collection: undefined }
    : state?.id === id && state.attempt === attempt ? state : undefined;
  return <SafeAreaView style={ui.screen} edges={['left', 'right']}>
    <Stack.Screen options={{ headerShown: false, animation: reducedMotion ? 'fade' : 'default', animationDuration: reducedMotion ? 150 : undefined }} />
    <PaperTexture />
    <FlatList data={current?.collection?.kits ?? []} keyExtractor={(kit) => kit.id}
      initialNumToRender={6} maxToRenderPerBatch={4} windowSize={5}
      contentContainerStyle={[ui.content, { paddingTop: Math.max(40, insets.top), paddingBottom: insets.bottom + 24 }]}
      ListHeaderComponent={<View style={{ gap: 20 }}>
      <BackButton onPress={() => router.back()} />
      <Text accessibilityRole="header" allowFontScaling style={ui.heading}>{current?.collection?.name ?? 'Your collection'}</Text>
      {!current && <Text style={ui.body}>Loading collection…</Text>}
      {current?.error && <>
        <Text accessibilityRole="alert" style={ui.body}>{current.error}</Text>
        <ActionButton label="Try again" onPress={() => setAttempt((value) => value + 1)} />
      </>}
      {current?.collection?.kits.length === 0 && <Text style={ui.body}>No kits in this collection yet.</Text>}
      </View>}
      renderItem={({ item: kit }) => <View testID={`collection-kit-${kit.id}`} style={[stockSurface, styles.kit]}>
        <PaperTexture />
        {kit.photo ? <Image source={{ uri: kit.photo.url }} contentFit="cover" style={styles.photo}
          accessibilityLabel={`Photo for ${kit.title}`} /> : <Text style={ui.body}>No photo in this kit.</Text>}
        <Text allowFontScaling style={styles.title}>{kit.title}</Text>
        <View style={styles.colors} accessible accessibilityLabel={COLOR_ROLES.map((role) => `${role}: ${kit.roles[role] ?? 'No color yet'}`).join(', ')}>
          {COLOR_ROLES.map((role) => <View key={role} style={[styles.color, { backgroundColor: kit.roles[role] ?? '#E4D9C6' }]} />)}
        </View>
      </View>} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  kit: { padding: 12, gap: 12, borderRadius: 3 },
  photo: { height: 220, width: '100%' },
  title: { fontFamily: fonts.heading, fontSize: 24, color: INK },
  colors: { flexDirection: 'row', gap: 4 },
  color: { flex: 1, height: 28, borderRadius: 2 },
});
