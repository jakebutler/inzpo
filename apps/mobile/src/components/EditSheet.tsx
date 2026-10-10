import { COLOR_ROLES, type ColorRole, type MobileKit, type RoleColors } from '@inzpo/shared';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { cloneElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { useInzpoClient } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { contrastTextColor } from '@/lib/contrast';
import { fonts, INK, PAPER } from '@/theme/tokens';
import { ui } from '@/theme/styles';
import { PaperPressable } from './PaperPressable';
import { PaperTexture } from './PaperTexture';
import { ActionButton } from './ActionButton';
import { EditBackdrop, sheetStyles, useSheetSpring } from './MotionSheet';

const rolePurpose: Record<ColorRole, string> = { primary: 'The color your project leads with.', secondary: 'A supporting color for balance.', accent: 'A little emphasis, when you need it.', background: 'The canvas behind everything.', surface: 'For cards, panels, and layers.', text: 'For the words on your background.' };
export type EditSheetHandle = { snapToPeek: () => void };
type Props = { visible: boolean; kit: MobileKit; onClose: () => void; onUpdated: (kit: MobileKit) => void;
  initialRole?: ColorRole; onSelectedRole?: (role: ColorRole | null) => void };

export const EditSheet = forwardRef<EditSheetHandle, Props>(
  function EditSheet({ visible, kit, onClose, onUpdated, initialRole, onSelectedRole }, ref) {
    const modal = useRef<BottomSheetModal>(null);
    const presented = useRef(false);
    const [index, setIndex] = useState<number>();
    const { height, fontScale } = useWindowDimensions();
    const snapPoints = [Math.min(height * .6, 152 + 88 * fontScale), '88%'];
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const backdrop = useCallback((props: BottomSheetBackdropProps) =>
      cloneElement(EditBackdrop(props), { pressBehavior: saving || dirty ? 'none' : 'close' }), [saving, dirty]);
    const animationConfigs = useSheetSpring();
    const reducedMotion = useReducedMotion();
    useImperativeHandle(ref, () => ({ snapToPeek: () => { if (!dirty && !saving) modal.current?.snapToIndex(0); } }), [dirty, saving]);
    // Only dismiss a presented modal; an early dismiss can swallow its first open.
    useEffect(() => {
      if (visible) { presented.current = true; modal.current?.present(); }
      else if (presented.current) { presented.current = false; modal.current?.dismiss(); }
    }, [visible, initialRole]);
    // Keep content panning enabled: toggling it changes Gorhom's wrapper type and remounts the draft.
    return (
      <BottomSheetModal
        ref={modal} name="edit-kit" index={1} snapPoints={snapPoints}
        enableDynamicSizing={false} enablePanDownToClose={!saving && !dirty}
        enableHandlePanningGesture={!saving && !dirty}
        keyboardBehavior="interactive" keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize" enableBlurKeyboardOnGesture
        animationConfigs={animationConfigs} overrideReduceMotion={reducedMotion ? ReduceMotion.Always : ReduceMotion.Never}
        backgroundStyle={sheetStyles.background} handleIndicatorStyle={sheetStyles.grabber}
        backdropComponent={backdrop} onChange={setIndex} onDismiss={() => { presented.current = false; setIndex(undefined); setSaving(false); setDirty(false); onClose(); }}
      >
        {visible && <EditSheetContent key={`${kit.id}-${initialRole ?? 'peek'}`} kit={kit} expanded={(index ?? 1) === 1}
          initialRole={initialRole} onSelectedRole={onSelectedRole}
          onExpand={() => { setIndex(1); modal.current?.snapToIndex(1); }}
          onClose={() => modal.current?.dismiss()} onUpdated={onUpdated} onSavingChange={setSaving} onDirtyChange={setDirty} />}
      </BottomSheetModal>
    );
  },
);

function EditSheetContent({ kit, expanded, onExpand, onClose, onUpdated, onSavingChange, onDirtyChange, initialRole, onSelectedRole }: {
  kit: MobileKit; expanded: boolean; onExpand: () => void; onClose: () => void; onUpdated: (kit: MobileKit) => void;
  onSavingChange: (saving: boolean) => void; onDirtyChange: (dirty: boolean) => void;
  initialRole?: ColorRole; onSelectedRole?: (role: ColorRole | null) => void;
}) {
  const client = useInzpoClient();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<RoleColors>(() => ({ ...kit.roles }));
  const [role, setRole] = useState<ColorRole | null>(initialRole ?? null);
  const [hex, setHex] = useState(initialRole ? kit.roles[initialRole] ?? '' : '');
  const [hexTouched, setHexTouched] = useState(false);
  const [hexError, setHexError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const inFlight = useRef(false);
  const active = useRef(true);
  useEffect(() => { onSavingChange(saving); }, [saving, onSavingChange]);
  useEffect(() => { onSelectedRole?.(role); }, [role, onSelectedRole]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const candidates = [...new Set([...kit.colors.map((color) => color.hex), ...Object.values(kit.roles)]
    .filter((color): color is string => color !== null).map((color) => color.toLowerCase()))];
  const changed = COLOR_ROLES.some((key) => draft[key]?.toLowerCase() !== kit.roles[key]?.toLowerCase());

  useEffect(() => { onDirtyChange(changed); }, [changed, onDirtyChange]);

  function choose(color: string | null) {
    if (!role) return;
    setDraft((current) => ({ ...current, [role]: color }));
    setHex(color ?? '');
    setHexError(false);
    setSaveError(false);
  }
  function changeHex(value: string) {
    setHex(value);
    setHexTouched(false);
    const clean = value.trim().replace(/^#/, '');
    const valid = /^[0-9a-fA-F]{6}$/.test(clean);
    setHexError(!valid);
    if (valid && role) {
      setDraft((current) => ({ ...current, [role]: `#${clean.toLowerCase()}` }));
      setSaveError(false);
    }
  }
  async function save() {
    if (inFlight.current || !changed || hexError) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(false);
    const roles: Partial<RoleColors> = {};
    for (const key of COLOR_ROLES) {
      if (draft[key]?.toLowerCase() !== kit.roles[key]?.toLowerCase()) roles[key] = draft[key];
    }
    try {
      const updated = await client.updateKitColors(kit.id, { roles });
      if (!active.current) return;
      void haptics.success();
      onUpdated(updated);
      onDirtyChange(false);
      onClose();
    } catch {
      if (!active.current) return;
      void haptics.error();
      setSaveError(true);
    } finally {
      inFlight.current = false;
      if (active.current) setSaving(false);
    }
  }
  function cancel() {
    if (!changed) { onClose(); return; }
    Alert.alert('Discard color changes?', 'Your saved colors will stay as they are.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard changes', style: 'destructive', onPress: onClose },
    ]);
  }
  return (
    <View style={{ flex: 1 }}>
    <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[ui.heading, { fontSize: 24, lineHeight: 28 }]}>Edit your colors</Text>
      <View style={styles.chips}>
        {COLOR_ROLES.map((key) => {
          const color = draft[key];
          return (
            <PaperPressable key={key} testID={`edit-role-${key}`} accessibilityRole="button"
              accessibilityLabel={color ? `${key}: ${color}` : `No ${key} in this one.`}
              accessibilityState={{ selected: role === key, disabled: saving }} disabled={saving}
              onPress={() => { setRole(key); setHex(color ?? ''); setHexError(false); setHexTouched(false); onExpand(); }}
              style={[styles.chip, color === null ? styles.empty : { backgroundColor: color }, role === key && styles.selected]}>
              <Text allowFontScaling style={[styles.role, { color: color === null ? INK : contrastTextColor(color) }]}>{key}</Text>
            </PaperPressable>
          );
        })}
      </View>
      {expanded && (
        <>
          {role ? <>
            <View style={styles.preview}>
              <View testID="edit-color-preview" style={{ width: 82, minHeight: 102, backgroundColor: draft[role] ?? PAPER,
                borderWidth: draft[role] ? 0 : 1, borderStyle: 'dashed', borderColor: INK }}><PaperTexture kind="color" /></View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text allowFontScaling style={[ui.heading, { fontSize: 27, lineHeight: 31 }]}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
                <Text style={ui.body}>{rolePurpose[role]}</Text>
                <Text style={[ui.label, { fontFamily: fonts.mono }]}>{draft[role]?.toUpperCase() ?? 'No color'}</Text>
              </View>
            </View>
            <Text allowFontScaling style={ui.label}>Choose {role}</Text>
            <View style={styles.swatches}>
              {candidates.map((color) => <PaperPressable key={color} accessibilityRole="button"
                accessibilityLabel={`Color ${color.toUpperCase()}`}
                accessibilityState={{ selected: draft[role]?.toLowerCase() === color, disabled: saving }}
                disabled={saving} onPress={() => choose(color)}
                style={[styles.swatch, { backgroundColor: color }, draft[role]?.toLowerCase() === color && styles.selected]} />)}
            </View>
            <Text style={ui.label}>Or enter a hex color</Text>
            <BottomSheetTextInput accessibilityLabel="Hex color" placeholder="#RRGGBB" placeholderTextColor={INK}
              autoCapitalize="none" autoCorrect={false} value={hex} onChangeText={changeHex} onBlur={() => setHexTouched(true)}
              editable={!saving} returnKeyType="done" onSubmitEditing={() => { setHexTouched(true); void save(); }} style={ui.input} />
            {hexError && hexTouched && <Text accessibilityRole="alert" style={ui.body}>Enter 6 hex digits.</Text>}
            <ActionButton label="Clear" disabled={saving || draft[role] === null} onPress={() => choose(null)} />
          </> : <Text style={ui.message}>Choose a role to edit its color.</Text>}
          {saveError && <Text accessibilityRole="alert" style={ui.body}>Couldn’t save these colors. Please try again.</Text>}
        </>
      )}
    </BottomSheetScrollView>
    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 12,
      paddingBottom: Math.max(16, insets.bottom), backgroundColor: PAPER }}>
      <View style={{ width: 90 }}><ActionButton label="Cancel" disabled={saving} onPress={cancel} /></View>
      <View style={{ flex: 1 }}><ActionButton label={saving ? 'Saving…' : 'Save colors'} primary disabled={saving || !changed || hexError} onPress={() => void save()} /></View>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32, gap: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexBasis: '30%', flexGrow: 1, minHeight: 44, padding: 8, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  empty: { backgroundColor: PAPER, borderWidth: 1, borderColor: INK, borderStyle: 'dashed' },
  selected: { borderWidth: 3, borderColor: INK, outlineWidth: 2, outlineColor: PAPER, outlineOffset: -5 },
  role: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 48, height: 48, borderRadius: 3, borderWidth: 1, borderColor: INK },
});
