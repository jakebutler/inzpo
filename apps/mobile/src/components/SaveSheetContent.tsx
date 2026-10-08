import { type CollectionSummary } from '@inzpo/shared';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInzpoClient } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { fonts, INK } from '@/theme/tokens';
import { HOP_TIMELINE } from '@/theme/motion';
import { ui } from '@/theme/styles';
import { ActionButton } from './ActionButton';
import { Baku } from './Baku';
import { SaveButton } from './SaveButton';

export type SavedCollection = { collectionId: string; collectionName: string };

export function SaveSheetContent({ kitId, onClose, onSaved, onSaveError, onSavingChange }: {
  kitId: string; onClose: () => void; onSaved?: (collection: SavedCollection) => void; onSaveError?: () => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const client = useInzpoClient();
  const insets = useSafeAreaInsets();
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
    <BottomSheetScrollView contentContainerStyle={[ui.content, { paddingBottom: Math.max(insets.bottom, 24) }]} keyboardShouldPersistTaps="handled">
      <Text allowFontScaling style={ui.heading}>Keep this kit</Text>
      <View style={styles.baku} accessibilityLiveRegion="polite">
        <Baku pose={successPose ? 'success' : saveError ? 'errorBrief' : 'idle'} />
      </View>
      {saved ? <Text allowFontScaling style={ui.body}>Its colors have a home.</Text> : (
        <>
          <Text allowFontScaling style={ui.body}>Choose a collection or start a new one.</Text>
          {loading && <Text allowFontScaling style={ui.body}>Loading collections…</Text>}
          {!loading && collections.length === 0 && !collectionError && <Text allowFontScaling style={ui.body}>Your first collection starts here.</Text>}
          <View style={styles.collections}>
            {collections.map((collection) => (
              <Pressable
                key={collection.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedId === collection.id, disabled: saving }}
                disabled={saving}
                onPress={() => { setSelectedId(collection.id); setNewName(''); }}
                style={[styles.collection, selectedId === collection.id && styles.selected]}
              >
                <Text allowFontScaling style={styles.collectionName}>{collection.name}</Text>
                <Text allowFontScaling style={ui.label}>{selectedId === collection.id ? 'Selected' : `${collection.count} kits`}</Text>
              </Pressable>
            ))}
          </View>
          <Text allowFontScaling style={ui.label}>New collection</Text>
          <BottomSheetTextInput
            accessibilityLabel="New collection name"
            placeholder="Collection name"
            placeholderTextColor={INK}
            autoFocus
            value={newName}
            onChangeText={(name) => { setNewName(name); setSelectedId(null); }}
            editable={!saving}
            maxLength={100}
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            style={ui.input}
          />
          {collectionError && (
            <>
              <Text allowFontScaling accessibilityRole="alert" style={ui.body}>{collectionError}</Text>
              <ActionButton label="Reload collections" disabled={loading || saving} onPress={() => {
                setLoading(true);
                setCollectionError(null);
                setAttempt((value) => value + 1);
              }} />
            </>
          )}
        </>
      )}
      <SaveButton saved={saved} saving={saving} disabled={saving || (!selectedId && !newName.trim())} onPress={() => void save()} />
      {saveError && <Text allowFontScaling accessibilityRole="alert" style={ui.message}>{saveError}</Text>}
      <ActionButton label={saved ? 'Done' : 'Cancel'} disabled={saving} onPress={onClose} />
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  baku: { alignItems: 'center' },
  collections: { gap: 10 },
  collection: {
    padding: 16, minHeight: 60, borderWidth: 1, borderColor: INK, borderRadius: 12,
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12,
  },
  selected: { borderWidth: 2 },
  collectionName: { fontFamily: fonts.body, fontSize: 16, color: INK, flex: 1 },
});
