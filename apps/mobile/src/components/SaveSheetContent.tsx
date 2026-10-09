import { type CollectionSummary, type MobileKit } from '@inzpo/shared';
import { BottomSheetScrollView, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInzpoClient } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { fonts, INK } from '@/theme/tokens';
import { HOP_TIMELINE } from '@/theme/motion';
import { ui } from '@/theme/styles';
import { ActionButton } from './ActionButton';
import { BackButton } from './BackButton';
import { CornerBaku } from './CornerBaku';
import { FilmPrint } from './FilmPrint';
import { InkIcon } from './InkIcon';
import { KitDeck } from './KitDeck';
import { PaperTexture } from './PaperTexture';
import { stockSurface } from '@/theme/materials';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { SaveButton } from './SaveButton';

export type SavedCollection = { collectionId: string; collectionName: string };

export function SaveSheetContent({ kitId, onClose, onSaved, onSaveError, onSavingChange, kit }: {
  kitId: string; kit?: MobileKit; onClose: () => void; onSaved?: (collection: SavedCollection) => void; onSaveError?: () => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const client = useInzpoClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(350, width - 40);
  const [footerHeight, setFooterHeight] = useState(48);
  const [fieldHeight, setFieldHeight] = useState(40);
  const [underline, setUnderline] = useState({ left: 0, width: contentWidth });
  const [photoFailed, setPhotoFailed] = useState(false);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [successPose, setSuccessPose] = useState(false);
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
      .then((items) => { if (current) setCollections(items); })
      .catch(() => { if (current) setCollectionError('Couldn’t load collections. Please try again.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, attempt]);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSuccessPose(false), HOP_TIMELINE.successHoldMs);
    return () => clearTimeout(timer);
  }, [saved]);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => onCloseRef.current(), 900);
    return () => clearTimeout(timer);
  }, [saved]);

  async function save() {
    if (saveInFlight.current || saved || (!selectedId && !newName.trim())) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await client.saveKit(kitId, selectedId ? { collectionId: selectedId } : { newName: newName.trim() });
      if (!active.current) return;
      setSaved(true);
      setSuccessPose(true);
      void haptics.success();
      onSaved?.({ collectionId: result.collectionId,
        collectionName: selectedId ? collections.find((collection) => collection.id === selectedId)?.name ?? 'your collection' : newName.trim() });
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
    <BottomSheetView style={styles.page}>
      <Animated.View style={styles.page} entering={FadeIn.duration(150).reduceMotion(ReduceMotion.Never)}>
      <PaperTexture />
      <BottomSheetScrollView testID="keep-scroll" contentContainerStyle={{ paddingTop: Math.max(40, insets.top),
        paddingBottom: footerHeight + Math.max(insets.bottom, 24) + 32, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: contentWidth, gap: 4 }}>
          <BackButton onPress={onClose} disabled={saving} />
          <Text allowFontScaling style={[ui.heading, { fontSize: 30, lineHeight: 32 }]}>Keep this kit</Text>
        </View>
        {kit && <View style={{ width: contentWidth, height: 480 }}>
          <View style={styles.sourcePrint}>
            <FilmPrint kit={kit} width={145} height={167} borderInset={7} foot={23} photoPosition={{ left: '50%', top: '34.7%' }}
              failed={photoFailed} onError={() => setPhotoFailed(true)}
              showPins={false} onPinPress={() => {}} placeholder={<Text style={ui.body}>No photo in this kit.</Text>} />
          </View>
          <KitDeck kit={kit} />
        </View>}
        <View style={{ width: contentWidth, gap: 12 }}>
          {saved ? <Text allowFontScaling accessibilityLiveRegion="polite" style={ui.body}>Its colors have a home.</Text> : <>
            <View>
              <Text allowFontScaling style={styles.fieldLabel}>New collection</Text>
              <Text allowFontScaling accessible={false} pointerEvents="none" style={[styles.name, styles.measureName]}
                onTextLayout={(event) => {
                  const last = event.nativeEvent.lines.at(-1);
                  if (last) setUnderline({ left: last.x, width: last.width });
                }}>{newName || kit?.title || 'Collection name'}</Text>
              <BottomSheetTextInput accessibilityLabel="New collection name" placeholder={kit?.title ?? 'Collection name'}
                placeholderTextColor={INK} autoFocus value={newName}
                onChangeText={(name) => { setNewName(name); setSelectedId(null); }} editable={!saving} maxLength={100}
                multiline scrollEnabled={false} returnKeyType="done" blurOnSubmit
                onContentSizeChange={(event) => setFieldHeight(Math.max(40, event.nativeEvent.contentSize.height))}
                onSubmitEditing={() => void save()} style={[styles.name, { minHeight: fieldHeight }]} />
              <Canvas accessible={false} pointerEvents="none" style={{ height: 8, width: contentWidth }}>
                <Path path={Skia.Path.MakeFromSVGString(`M${underline.left + 2} 5 Q${underline.left + underline.width * 0.45} 3 ${underline.left + underline.width - 3} 4`)!}
                  color="#61594C" style="stroke" strokeWidth={0.75} strokeCap="round" />
              </Canvas>
            </View>
            <Text allowFontScaling style={styles.hint}>Name it the way you’d write it on the back of a photo.</Text>
            <Text allowFontScaling style={ui.body}>Choose a collection or start a new one.</Text>
            {loading && <Text allowFontScaling style={ui.body}>Loading collections…</Text>}
            {!loading && collections.length === 0 && !collectionError && <Text allowFontScaling style={ui.body}>Your first collection starts here.</Text>}
            <View style={styles.collections}>
              {collections.map((collection) => <Pressable key={collection.id} accessibilityRole="radio"
                accessibilityLabel={`${collection.name}, ${collection.count} kits`}
                accessibilityState={{ checked: selectedId === collection.id, disabled: saving }} disabled={saving}
                onPress={() => { setSelectedId(collection.id); setNewName(''); }}
                style={[stockSurface, styles.collection, selectedId === collection.id && styles.selected]}>
                <PaperTexture />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text allowFontScaling style={styles.collectionName}>{collection.name}</Text>
                  <Text allowFontScaling style={ui.label}>{`${collection.count} kits`}</Text>
                </View>
                {selectedId === collection.id ? <InkIcon name="check" /> : <View style={styles.choice} />}
              </Pressable>)}
            </View>
            {collectionError && <>
              <Text allowFontScaling accessibilityRole="alert" style={ui.body}>{collectionError}</Text>
              <ActionButton label="Reload collections" disabled={loading || saving} onPress={() => {
                setLoading(true); setCollectionError(null); setAttempt((value) => value + 1);
              }} />
            </>}
          </>}
          {saveError && <Text allowFontScaling accessibilityRole="alert" style={ui.message}>{saveError}</Text>}
        </View>
      </BottomSheetScrollView>
      <View style={[styles.footer, { bottom: Math.max(insets.bottom, 24) }]}>
        <PaperTexture />
        <View style={styles.host} accessibilityLiveRegion="polite">
          <CornerBaku focused size={64} testID="keep-baku" shadowTestID="keep-contact-shadow" pose={successPose ? 'success' : saveError ? 'errorBrief' : 'idle'} />
        </View>
        <View style={styles.actions} onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
          <View style={{ width: 96 }}><ActionButton label={saved ? 'Done' : 'Not now'} disabled={saving} onPress={onClose} /></View>
          <View style={{ flex: 1 }}><SaveButton label="Save kit" saved={saved} saving={saving}
            disabled={saving || (!selectedId && !newName.trim())} onPress={() => void save()} /></View>
        </View>
      </View>
      </Animated.View>
    </BottomSheetView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  sourcePrint: { position: 'absolute', left: 12, top: 310, transform: [{ rotate: '-3deg' }] },
  fieldLabel: { fontFamily: fonts.body, fontSize: 11, color: INK },
  name: { fontFamily: fonts.heading, fontSize: 32, lineHeight: 38.4, letterSpacing: -0.6, color: INK, padding: 0 },
  measureName: { position: 'absolute', top: 14, left: 0, right: 0, opacity: 0 },
  hint: { fontFamily: fonts.body, fontSize: 44 / 3, lineHeight: 21, fontStyle: 'italic', color: INK },
  collections: { gap: 10 },
  collection: { padding: 16, minHeight: 60, borderRadius: 3, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selected: { borderColor: '#426092', borderWidth: 1 },
  collectionName: { fontFamily: fonts.body, fontSize: 16, color: INK },
  choice: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#857B68' },
  footer: { position: 'absolute', left: 0, right: 0, paddingTop: 12, backgroundColor: '#F3EEE4' },
  host: { position: 'absolute', left: 16, bottom: -8 },
  actions: { marginLeft: 82, marginRight: 16, flexDirection: 'row', gap: 8 },
});
