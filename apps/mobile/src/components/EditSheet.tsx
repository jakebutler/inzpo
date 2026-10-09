import { COLOR_ROLES, type ColorRole, type MobileKit, type RoleColors } from '@inzpo/shared';
import { BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { cloneElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { useInzpoClient } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { contrastTextColor } from '@/lib/contrast';
import { fonts, INK, PAPER } from '@/theme/tokens';
import { ui } from '@/theme/styles';
import { ActionButton } from './ActionButton';
import { EditBackdrop, sheetStyles, useSheetSpring } from './MotionSheet';

const SNAP_POINTS = [156, '64%'];
export type EditSheetHandle = { snapToPeek: () => void };
type Props = { visible: boolean; kit: MobileKit; onClose: () => void; onUpdated: (kit: MobileKit) => void;
  initialRole?: ColorRole; onSelectedRole?: (role: ColorRole | null) => void };

export const EditSheet = forwardRef<EditSheetHandle, Props>(
  function EditSheet({ visible, kit, onClose, onUpdated, initialRole, onSelectedRole }, ref) {
    const modal = useRef<BottomSheetModal>(null);
    const [index, setIndex] = useState<number>();
    const [saving, setSaving] = useState(false);
    const backdrop = useCallback((props: BottomSheetBackdropProps) =>
      cloneElement(EditBackdrop(props), { pressBehavior: saving ? 'none' : 'close' }), [saving]);
    const animationConfigs = useSheetSpring();
    const reducedMotion = useReducedMotion();
    useImperativeHandle(ref, () => ({ snapToPeek: () => modal.current?.snapToIndex(0) }), []);
    useEffect(() => {
      if (visible) modal.current?.present();
      else modal.current?.dismiss();
    }, [visible, initialRole]);
    return (
      <BottomSheetModal
        ref={modal} name="edit-kit" index={initialRole ? 1 : 0} snapPoints={SNAP_POINTS}
        enableDynamicSizing={false} enablePanDownToClose={!saving}
        keyboardBehavior="interactive" keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize" enableBlurKeyboardOnGesture
        animationConfigs={animationConfigs} overrideReduceMotion={reducedMotion ? ReduceMotion.Always : ReduceMotion.Never}
        backgroundStyle={sheetStyles.background} handleIndicatorStyle={sheetStyles.grabber}
        backdropComponent={backdrop} onChange={setIndex} onDismiss={() => { setIndex(undefined); setSaving(false); onClose(); }}
      >
        {visible && <EditSheetContent key={`${kit.id}-${initialRole ?? 'peek'}`} kit={kit} expanded={(index ?? (initialRole ? 1 : 0)) === 1}
          initialRole={initialRole} onSelectedRole={onSelectedRole}
          onExpand={() => { setIndex(1); modal.current?.snapToIndex(1); }}
          onClose={() => modal.current?.dismiss()} onUpdated={onUpdated} onSavingChange={setSaving} />}
      </BottomSheetModal>
    );
  },
);

function EditSheetContent({ kit, expanded, onExpand, onClose, onUpdated, onSavingChange, initialRole, onSelectedRole }: {
  kit: MobileKit; expanded: boolean; onExpand: () => void; onClose: () => void; onUpdated: (kit: MobileKit) => void;
  onSavingChange: (saving: boolean) => void;
  initialRole?: ColorRole; onSelectedRole?: (role: ColorRole | null) => void;
}) {
  const client = useInzpoClient();
  const [draft, setDraft] = useState<RoleColors>(() => ({ ...kit.roles }));
  const [role, setRole] = useState<ColorRole | null>(initialRole ?? null);
  const [hex, setHex] = useState(initialRole ? kit.roles[initialRole] ?? '' : '');
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

  function choose(color: string | null) {
    if (!role) return;
    setDraft((current) => ({ ...current, [role]: color }));
    setHex(color ?? '');
    setHexError(false);
    setSaveError(false);
  }
  function changeHex(value: string) {
    setHex(value);
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
  return (
    <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.chips}>
        {COLOR_ROLES.map((key) => {
          const color = draft[key];
          return (
            <Pressable key={key} testID={`edit-role-${key}`} accessibilityRole="button"
              accessibilityLabel={color ? `${key}: ${color}` : `No ${key} in this one.`}
              accessibilityState={{ selected: role === key, disabled: saving }} disabled={saving}
              onPress={() => { setRole(key); setHex(color ?? ''); setHexError(false); onExpand(); }}
              style={[styles.chip, color === null ? styles.empty : { backgroundColor: color }, role === key && styles.selected]}>
              <Text allowFontScaling style={[styles.role, { color: color === null ? INK : contrastTextColor(color) }]}>{key}</Text>
            </Pressable>
          );
        })}
      </View>
      {expanded && (
        <>
          {role ? <>
            <Text allowFontScaling style={ui.message}>Pick a {role} color</Text>
            <View style={styles.swatches}>
              {candidates.map((color) => <Pressable key={color} accessibilityRole="button"
                accessibilityLabel={`Color ${color.toUpperCase()}`}
                accessibilityState={{ selected: draft[role]?.toLowerCase() === color, disabled: saving }}
                disabled={saving} onPress={() => choose(color)}
                style={[styles.swatch, { backgroundColor: color }, draft[role]?.toLowerCase() === color && styles.selected]} />)}
            </View>
            <BottomSheetTextInput accessibilityLabel="Hex color" placeholder="#RRGGBB" placeholderTextColor={INK}
              autoCapitalize="none" autoCorrect={false} value={hex} onChangeText={changeHex}
              editable={!saving} returnKeyType="done" onSubmitEditing={() => void save()} style={ui.input} />
            {hexError && <Text accessibilityRole="alert" style={ui.body}>Enter 6 hex digits.</Text>}
            <ActionButton label="Clear" disabled={saving} onPress={() => choose(null)} />
          </> : <Text style={ui.message}>Choose a role to edit its color.</Text>}
          <ActionButton label={saving ? 'Saving…' : 'Save colors'} primary disabled={saving || !changed || hexError} onPress={() => void save()} />
          {saveError && <Text accessibilityRole="alert" style={ui.body}>Couldn’t save these colors. Please try again.</Text>}
          <ActionButton label="Cancel" disabled={saving} onPress={onClose} />
        </>
      )}
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32, gap: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexBasis: '30%', flexGrow: 1, minHeight: 44, padding: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  empty: { backgroundColor: PAPER, borderWidth: 1, borderColor: INK, borderStyle: 'dashed' },
  selected: { borderWidth: 3, borderColor: INK, outlineWidth: 2, outlineColor: PAPER, outlineOffset: -5 },
  role: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: INK },
});
