import { PaperTexture } from '@/components/PaperTexture';
import { beginCapture } from '@/lib/capture-session';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { haptics } from '@/lib/haptics';
import { SHUTTER_PRESS_SCALE } from '@/theme/motion';
import { ui } from '@/theme/styles';

export default function SnapScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function pick(source: 'camera' | 'library') {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setCameraDenied(false);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setCameraDenied(true);
          setError('Allow camera access in Settings, or choose a photo from your library.');
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
      if (result.canceled) return;
      const photo = result.assets[0];
      if (!photo) throw new Error('No photo selected');
      if (!mounted.current) return;
      const id = beginCapture(photo);
      router.push({ pathname: '/kit/[id]', params: { id, capture: '1' } });
    } catch {
      setError('Couldn’t open that photo. Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return <SafeAreaView style={ui.screen} edges={['bottom', 'left', 'right']}>
    <PaperTexture />
    <ScrollView contentContainerStyle={[ui.content, { flexGrow: 1, justifyContent: 'center' }]}>
      <Text accessibilityRole="header" style={ui.heading}>Inspiration is everywhere.</Text>
      <Text style={ui.body}>A flower. A storefront. Your favorite mug. Keep its colors for your next idea.</Text>
      <View style={{ alignItems: 'center', gap: 16, paddingVertical: 20 }} accessibilityLiveRegion="polite">
        <Image source={require('../../../assets/baku-performance/neutral-monotone.webp')} contentFit="contain"
          accessibilityLabel="Baku, your knitted tapir, ready for a little inspiration." style={{ width: 300, maxWidth: '100%', height: 200 }} />
        {error && <Text accessibilityRole="alert" style={ui.message}>{error}</Text>}
      </View>
      {cameraDenied && <ActionButton label="Open Settings" onPress={() => void Linking.openSettings()} />}
      <ActionButton label="Take a photo" primary disabled={busy} pressScale={SHUTTER_PRESS_SCALE}
        onPressIn={() => void haptics.light()} onPress={() => void pick('camera')} />
      <ActionButton label="Choose from library" disabled={busy} onPressIn={() => void haptics.light()} onPress={() => void pick('library')} />
      <View style={{ marginTop: 16 }}><ActionButton label="Your inspiration" disabled={busy} onPress={() => router.push('/collections')} /></View>
    </ScrollView>
  </SafeAreaView>;
}
