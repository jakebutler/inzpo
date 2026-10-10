import { type CollectionSummary, type MobileKit } from '@inzpo/shared';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInzpoClient } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { fonts, INK, PAPER } from '@/theme/tokens';
import { ui } from '@/theme/styles';
import { ActionButton } from './ActionButton';
import { BackButton } from './BackButton';
import { FilmPrint } from './FilmPrint';
import { InkIcon } from './InkIcon';
import { KitDeck } from './KitDeck';
import { PaperTexture } from './PaperTexture';
import { stockSurface } from '@/theme/materials';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { PaperPressable } from './PaperPressable';
import { SaveButton } from './SaveButton';

export type SavedCollection = { collectionId: string; collectionName: string };

export function KeepScreen({ kitId, onClose, onSaved, onSaveError, onSavingChange, kit }: {
  kitId: string; kit?: MobileKit; onClose: () => void; onSaved?: (collection: SavedCollection) => void; onSaveError?: () => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const client = useInzpoClient();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const contentWidth = Math.min(350, width - 40);
  const [headerHeight, setHeaderHeight] = useState(Math.max(40, insets.top) + 44 + 4 + 32 * fontScale);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [formHeight, setFormHeight] = useState(180 * fontScale);
  const availableHeight = viewportHeight ?? height - headerHeight - 60 - Math.max(insets.bottom, 24);
  // Reserve the measured form and footer before scaling the entire fan/photo.
  // Keep a readable minimum when the keyboard, picker or large type needs scrolling.
  const artScale = Math.min(1, contentWidth / 350, Math.max(0.35, (availableHeight - formHeight - 16) / 480));
  const scrollRef = useRef<ScrollView>(null);
  const [fieldHeight, setFieldHeight] = useState(40);
  const [underline, setUnderline] = useState({ left: 0, width: contentWidth });
  const [stableArtScale, setStableArtScale] = useState(artScale);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const destinationTouched = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const defaultTitle = kit?.title.trim() || 'Untitled kit';
  const [kitName, setKitName] = useState(defaultTitle);
  const defaultName = 'My collection';
  const [choosingCollection, setChoosingCollection] = useState(false);
  useEffect(() => {
    if (!choosingCollection) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [choosingCollection]);
  const [newName, setNewName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const saveInFlight = useRef(false);
  const active = useRef(true);
  useEffect(() => { onSavingChange?.(saving); }, [saving, onSavingChange]);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    let current = true;
    client.listCollections()
      .then((items) => { if (current) { setCollections(items); setSelectedId(previous => destinationTouched.current ? previous : items[0]?.id ?? null); setCollectionError(null); } })
      .catch(() => { if (current) setCollectionError('Couldn’t load collections. Please try again.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, attempt]);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => onCloseRef.current(), 900);
    return () => clearTimeout(timer);
  }, [saved]);

  async function save() {
    if (saveInFlight.current || saved || loading || collectionError) return;
    setStableArtScale(artScale);
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await client.saveKit(kitId, { title: kitName.trim() || defaultTitle, ...(selectedId ? { collectionId: selectedId } : { newName: newName.trim() || defaultName }) });
      if (!active.current) return;
      setSaved(true);
      void haptics.success();
      onSaved?.({ collectionId: result.collectionId,
        collectionName: selectedId ? collections.find((collection) => collection.id === selectedId)?.name ?? 'your collection' : newName.trim() || defaultName });
    } catch {
      if (!active.current) return;
      setSaveError('Couldn’t save this kit. Please try again.');
      void haptics.error();
      onSaveError?.();
    } finally {
      saveInFlight.current = false;
      if (active.current) setSaving(false);
    }
  }

  return (
    <SafeAreaView style={ui.screen} edges={['left', 'right']} testID="keep-screen">
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Animated.View style={styles.page} entering={FadeIn.duration(150).reduceMotion(ReduceMotion.Never)}>
      <PaperTexture />
      <View testID="keep-header" style={[styles.header, { width: contentWidth, paddingTop: Math.max(40, insets.top) }]}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
        <BackButton onPress={onClose} disabled={saving} />
        <Text accessibilityRole="header" allowFontScaling style={[ui.heading, { fontSize: 30, lineHeight: 32 }]}>Keep this kit</Text>
      </View>
      <ScrollView ref={scrollRef} testID="keep-scroll" style={[styles.scroll, { marginTop: headerHeight }]}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        contentContainerStyle={{ paddingBottom: 16, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        {kit && <View testID="keep-art" style={{ width: contentWidth, height: 480 * (saving || saved ? stableArtScale : artScale) }}>
          <View style={{ width: contentWidth, height: 480, transformOrigin: '50% 0%', transform: [{ scale: saving || saved ? stableArtScale : artScale }] }}>
          <View style={styles.sourcePrint}>
            <FilmPrint kit={kit} width={145} height={167} borderInset={7} foot={23} photoPosition={{ left: '50%', top: '34.7%' }}
              failed={photoFailed} onError={() => setPhotoFailed(true)}
              showPins={false} onPinPress={() => {}} placeholder={<Text style={ui.body}>No photo in this kit.</Text>} />
          </View>
          <KitDeck kit={kit} gathered={saved} />
          </View>
        </View>}
        <View testID="keep-form" style={{ width: contentWidth, gap: 12, minHeight: saved ? formHeight : undefined }}
          onLayout={(event) => { if (!saved && !saving) setFormHeight(event.nativeEvent.layout.height); }}>
          {saved ? <Text allowFontScaling accessibilityLiveRegion="polite" style={ui.body}>Saved to {selectedId ? collections.find(collection => collection.id === selectedId)?.name ?? 'your collection' : newName.trim() || defaultName}.</Text> : <>
            <View>
              <Text allowFontScaling style={styles.fieldLabel}>Kit name</Text>
              <Text allowFontScaling accessible={false} pointerEvents="none" style={[styles.name, styles.measureName]}
                onTextLayout={(event) => {
                  const last = event.nativeEvent.lines.at(-1);
                  if (last) {
                    setUnderline({ left: last.x, width: last.width });
                    setFieldHeight(Math.max(38.4, last.y + last.height));
                  }
                }}>{kitName || defaultTitle}</Text>
              <TextInput accessibilityLabel="Kit name" placeholder={defaultTitle}
                placeholderTextColor={INK} value={kitName}
                onChangeText={setKitName} editable={!saving} maxLength={100}
                multiline scrollEnabled={false} returnKeyType="done" blurOnSubmit
                underlineColorAndroid="transparent"
                onSubmitEditing={() => void save()} style={[styles.name, { height: fieldHeight },
                  Platform.OS === 'web' && { outlineWidth: 0 }]} />
              <Canvas accessible={false} pointerEvents="none" style={{ height: 8, width: contentWidth }}>
                <Path path={Skia.Path.MakeFromSVGString(`M${underline.left + 2} 5 Q${underline.left + underline.width * 0.45} 3 ${underline.left + underline.width - 3} 4`)!}
                  color="#61594C" style="stroke" strokeWidth={0.75} strokeCap="round" />
              </Canvas>
            </View>
            <Text allowFontScaling style={styles.hint}>{"Name it the way you'd write it on the back of a photo."}</Text>
            <View testID="keep-collection-row" style={styles.collectionRow}>
              <Text allowFontScaling style={styles.fieldLabel}>Collection</Text>
              {loading ? <Text style={styles.collectionValue}>Finding your collections…</Text> : collectionError ? <Text style={styles.collectionValue}>Choose a destination</Text> : selectedId ? <Text allowFontScaling style={styles.collectionValue}>{collections.find((collection) => collection.id === selectedId)?.name}</Text>
                : <TextInput accessibilityLabel="New collection name" value={newName} onChangeText={setNewName}
                  editable={!saving} maxLength={100} placeholder="Collection name" underlineColorAndroid="transparent"
                  style={[styles.collectionValue, { padding: 0, height: 20 * fontScale }]} />}
              <PaperPressable accessibilityRole="button" accessibilityLabel="Choose collection" disabled={saving || loading || !!collectionError}
                onPress={() => setChoosingCollection((value) => !value)} style={styles.collectionChange}>
                <Text style={styles.fieldLabel}>{choosingCollection ? 'Done' : 'Change'}</Text>
              </PaperPressable>
            </View>
            {choosingCollection && <>
            {!loading && collections.length === 0 && !collectionError && <Text allowFontScaling style={ui.body}>Your first collection starts here.</Text>}
            <View style={styles.collections}>
              <PaperPressable accessibilityRole="radio" accessibilityLabel="Start a new collection"
                accessibilityState={{ checked: selectedId === null, disabled: saving }} disabled={saving}
                onPress={() => { destinationTouched.current = true; setSelectedId(null); setChoosingCollection(false); }} style={[stockSurface, styles.collection]}>
                <Text style={styles.collectionName}>Start a new collection</Text>
              </PaperPressable>
              {collections.map((collection) => <PaperPressable key={collection.id} accessibilityRole="radio"
                accessibilityLabel={`${collection.name}, ${collection.count} kits`}
                accessibilityState={{ checked: selectedId === collection.id, disabled: saving }} disabled={saving}
                onPress={() => { destinationTouched.current = true; setSelectedId(collection.id); setChoosingCollection(false); }}
                style={[stockSurface, styles.collection, selectedId === collection.id && styles.selected]}>
                <PaperTexture />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text allowFontScaling style={styles.collectionName}>{collection.name}</Text>
                  <Text allowFontScaling style={ui.label}>{`${collection.count} kits`}</Text>
                </View>
                {selectedId === collection.id ? <InkIcon name="check" /> : <View style={styles.choice} />}
              </PaperPressable>)}
            </View>
            </>}
          </>}
            {collectionError && <>
              <Text allowFontScaling accessibilityRole="alert" style={ui.body}>{collectionError}</Text>
              <ActionButton label="Reload collections" disabled={loading || saving} onPress={() => {
                setLoading(true); setCollectionError(null); setAttempt((value) => value + 1);
              }} />
            </>}
          {saveError && <Text allowFontScaling accessibilityRole="alert" style={ui.message}>{saveError}</Text>}
        </View>
      </ScrollView>
      <View testID="keep-footer" style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <PaperTexture />
        <View style={styles.actions}>
          <View style={{ width: 96 }}><ActionButton label={saved ? 'Done' : 'Not now'} disabled={saving} onPress={onClose} /></View>
          <View style={{ flex: 1 }}><SaveButton label="Save kit" saved={saved} saving={saving}
            disabled={saving || loading || !!collectionError} onPress={() => void save()} /></View>
        </View>
      </View>
      </Animated.View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAPER },
  header: { position: 'absolute', top: 0, zIndex: 20, alignSelf: 'center', gap: 4, flexShrink: 0 },
  scroll: { flex: 1, flexBasis: 0, minHeight: 0 },
  sourcePrint: { position: 'absolute', left: 12, top: 310, transform: [{ rotate: '-3deg' }] },
  fieldLabel: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: INK, marginBottom: 4 },
  name: { fontFamily: fonts.heading, fontSize: 32, lineHeight: 38.4, letterSpacing: -0.6, color: INK,
    padding: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
  measureName: { position: 'absolute', top: 14, left: 0, right: 0, opacity: 0 },
  hint: { fontFamily: fonts.body, fontSize: 14, letterSpacing: -0.2, lineHeight: 20, fontStyle: 'italic', color: INK },
  collectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  collectionValue: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: INK },
  collectionChange: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  collections: { gap: 10 },
  collection: { padding: 16, minHeight: 60, borderRadius: 3, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selected: { borderColor: '#426092', borderWidth: 1 },
  collectionName: { fontFamily: fonts.body, fontSize: 16, color: INK },
  choice: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#857B68' },
  footer: { flexShrink: 0, paddingTop: 12, backgroundColor: PAPER },
  actions: { marginLeft: 16, marginRight: 16, flexDirection: 'row', gap: 8 },
});
