import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, INK, PAPER } from '@/theme/tokens';
import { AtlasPlayer, LAB_KITS, landingDeadline, type LabController } from './AtlasPlayer';

export function MunchLab() {
  const [width, setWidth] = useState(0);
  const [seconds, setSeconds] = useState(3);
  const [kit, setKit] = useState(0);
  const [ready, setReady] = useState(false);
  const controller = useRef<LabController | null>(null);
  const attach = useCallback((value: LabController) => { controller.current = value; setReady(value.ready); }, []);
  return (
    <SafeAreaView style={styles.screen} onTouchEnd={() => controller.current?.skip()}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row} onTouchEnd={(event) => event.stopPropagation()}>
          <Text style={styles.title}>Munch lab</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close munch lab" style={styles.button} onPress={() => router.dismissTo('/')}>
            <Text style={styles.label}>Close</Text>
          </Pressable>
        </View>
        <Text style={styles.caption}>STAND-IN FRAMES · Baku is a felt tapir. Final art will be pre-rendered 3D.</Text>
        <View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
          {width > 0 && <AtlasPlayer width={width} kit={LAB_KITS[kit]} onController={attach} />}
        </View>
        <View style={styles.controls} onTouchEnd={(event) => event.stopPropagation()}>
          <Text style={styles.label}>Fake extraction resolves after {seconds}s</Text>
          <View style={styles.row}>
            {[0, 1, 3, 8, 15].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Resolve after ${value} seconds`}
              accessibilityState={{ selected: value === seconds }} onPress={() => setSeconds(value)} style={[styles.button, value === seconds && styles.selected]}>
              <Text style={styles.label}>{value}s</Text>
            </Pressable>)}
          </View>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel="Start munch sequence" accessibilityState={{ disabled: !ready }} disabled={!ready}
              onPress={() => controller.current?.start(seconds)} style={[styles.button, styles.start, !ready && { opacity: .4 }]}>
              <Text style={[styles.label, { color: PAPER }]}>{ready ? 'Start / replay' : 'Preloading…'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Change live stripe colors" onPress={() => setKit((value) => 1 - value)} style={styles.button}>
              <Text style={styles.label}>Switch kit</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.caption}>Tap anywhere to land all five chips. Reduce Motion uses a fade. Chew repeats until extraction resolves, then finishes its cycle.</Text>
        <Text style={styles.caption}>60fps target · 75ms role stagger · 3% travel overshoot · all chips land in {landingDeadline / 1000}s.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  content: { padding: 16, gap: 12, maxWidth: 600, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  title: { fontFamily: fonts.heading, fontSize: 30, color: INK },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: '#625C54' },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: INK },
  button: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12, backgroundColor: '#E4D9C6' },
  selected: { borderWidth: 1, borderColor: INK },
  start: { backgroundColor: INK, flexGrow: 1, alignItems: 'center' },
  controls: { gap: 12 },
});
