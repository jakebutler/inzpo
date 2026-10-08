import { type CollectionSummary } from '@inzpo/shared';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInzpoClient } from '@/lib/api';
import { fonts, INK, PAPER } from '@/theme/tokens';
import { ui } from '@/theme/styles';
import { ActionButton } from './ActionButton';
import { Baku } from './Baku';

export function SaveSheetContent({ kitId, onClose }: { kitId: string; onClose: () => void }) {
  const client = useInzpoClient();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const saveInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    client.listCollections()
      .then((items) => { if (active) setCollections(items); })
      .catch(() => { if (active) setError('Couldn’t load collections. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, attempt]);

  async function save() {
    if (saveInFlight.current || (!selectedId && !newName.trim())) return;
    saveInFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      await client.saveKit(kitId, selectedId ? { collectionId: selectedId } : { newName: newName.trim() });
      setSaved(true);
    } catch {
      setError('Couldn’t save this kit. Please try again.');
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={ui.screen}>
      <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
          <Text style={ui.heading}>{saved ? 'Saved' : 'Keep this kit'}</Text>
          {saved ? (
            <View style={styles.success} accessibilityLiveRegion="polite">
              <Baku pose="success" />
              <Text style={ui.body}>Its colors have a home.</Text>
              <ActionButton label="Done" onPress={onClose} />
            </View>
          ) : (
            <>
              <Text style={ui.body}>Choose a collection or start a new one.</Text>
              {loading && <Text style={ui.body}>Loading collections…</Text>}
              {!loading && collections.length === 0 && !error && <Text style={ui.body}>Your first collection starts here.</Text>}
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
                    <Text style={styles.collectionName}>{collection.name}</Text>
                    <Text style={ui.label}>{selectedId === collection.id ? 'Selected' : `${collection.count} kits`}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={ui.label}>New collection</Text>
              <TextInput
                accessibilityLabel="New collection name"
                placeholder="Collection name"
                placeholderTextColor={INK}
                value={newName}
                onChangeText={(name) => { setNewName(name); setSelectedId(null); }}
                editable={!saving}
                maxLength={100}
                returnKeyType="done"
                style={ui.input}
              />
              {error && <Text accessibilityRole="alert" style={ui.body}>{error}</Text>}
              {error?.startsWith('Couldn’t load') && (
                <ActionButton label="Reload collections" disabled={loading || saving} onPress={() => {
                  setLoading(true);
                  setError(null);
                  setAttempt((value) => value + 1);
                }} />
              )}
              <ActionButton label={saving ? 'Saving…' : 'Save'} primary disabled={saving || (!selectedId && !newName.trim())} onPress={() => void save()} />
              <ActionButton label="Cancel" disabled={saving} onPress={onClose} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  collections: { gap: 10 },
  collection: {
    padding: 16, minHeight: 60, borderWidth: 1, borderColor: INK, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
  },
  selected: { borderWidth: 2 },
  collectionName: { fontFamily: fonts.body, fontSize: 16, color: INK, flex: 1 },
  success: { gap: 20, alignItems: 'center', backgroundColor: PAPER },
});
