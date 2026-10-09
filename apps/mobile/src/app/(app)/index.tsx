import { ChewingCaption } from '@/components/ChewingCaption';
import { FilmPrint } from '@/components/FilmPrint';
import { MunchPlayer } from '@/munch/MunchPlayer';
import { handoffPhoto } from '@/lib/photo-handoff';
import { emptyRoles } from '@inzpo/shared';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '@/components/ActionButton';
import { Baku } from '@/components/Baku';
import { useInzpoClient } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { uploadPhoto, type PhotoInput } from '@/lib/upload';
import { SHUTTER_PRESS_SCALE } from '@/theme/motion';
import { ui } from '@/theme/styles';

export default function SnapScreen() {
  const client = useInzpoClient();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoInput | null>(null);
  const [displayedPhoto, setDisplayedPhoto] = useState<PhotoInput | null>(null);
  const photoDisplayed = !!selectedPhoto && displayedPhoto === selectedPhoto;

  async function pick(source: 'camera' | 'library') {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Allow camera access in Settings to snap a house.');
          return;
        }
      }
      // TODO(motion): Full-screen expo-camera CameraView, paper flash (35%,
      // 80ms hold/120ms fade), then shared-element hand-off to the result photo.
      // The system image-only library picker does not need broad photo access.
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
      if (result.canceled) return;
      const photo = result.assets[0];
      if (!photo) throw new Error('No photo selected');
      setSelectedPhoto(photo);
      setDisplayedPhoto(null);
      setUploading(true);
      const itemId = await uploadPhoto(client, photo);
      handoffPhoto(itemId, photo);
      router.push({ pathname: '/kit/[id]', params: { id: itemId } });
    } catch {
      setError('Couldn’t keep this photo. Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
      setUploading(false);
    }
  }

  return (
    <SafeAreaView style={ui.screen} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={[ui.content, { flexGrow: 1, justifyContent: 'center' }]}>
        <Text style={ui.heading}>A house worth keeping.</Text>
        <Text style={ui.body}>Bring its colors home.</Text>
        <View style={{ alignItems: 'center', gap: 16, paddingVertical: 24 }} accessibilityLiveRegion="polite">
          {uploading && selectedPhoto ? <>
            <FilmPrint kit={{ photo: { url: selectedPhoto.uri, width: selectedPhoto.width, height: selectedPhoto.height, placeholder: null }, roles: emptyRoles(), colors: [] }}
              width={240} height={330} failed={false} onError={() => setDisplayedPhoto(null)} onPhotoDisplay={() => setDisplayedPhoto(selectedPhoto)}
              showPins={false} onPinPress={() => {}} placeholder={null} />
            {photoDisplayed && <MunchPlayer width={240} active />}
            {photoDisplayed && <ChewingCaption />}
          </> : <Baku pose={error ? 'errorPhoto' : 'idle'} size={128} />}
          {error && <Text accessibilityRole="alert" style={ui.message}>{error}</Text>}
        </View>
        <ActionButton label="Snap a house" primary disabled={busy} pressScale={SHUTTER_PRESS_SCALE} onPressIn={() => void haptics.light()} onPress={() => void pick('camera')} />
        <ActionButton label="Pick from library" disabled={busy} onPressIn={() => void haptics.light()} onPress={() => void pick('library')} />
      </ScrollView>
    </SafeAreaView>
  );
}
