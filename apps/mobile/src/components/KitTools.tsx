import { copyKitText, exportKitText, exportKitFilename, type ExportFormat, type MobileKit } from '@inzpo/shared';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton } from './ActionButton';
import { haptics } from '@/lib/haptics';
import { ui } from '@/theme/styles';

export function KitTools({ kit }: { kit: MobileKit }) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function perform(format?: ExportFormat) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    let file: File | undefined;
    try {
      if (!format) {
        await Clipboard.setStringAsync(copyKitText(kit));
        setMessage(kit.brief.status === 'ready' ? 'Kit copied. Make something with it.' : 'Colors copied. The description is still on its way.');
        void haptics.success();
      } else if (await Sharing.isAvailableAsync()) {
        file = new File(Paths.cache, exportKitFilename(kit, format));
        file.create({ overwrite: true });
        file.write(exportKitText(kit, format));
        await Sharing.shareAsync(file.uri, { mimeType: format === 'css' ? 'text/css' : 'application/json',
          UTI: format === 'css' ? 'public.css' : 'public.json', dialogTitle: 'Use this kit' });
      } else {
        await Clipboard.setStringAsync(exportKitText(kit, format));
        setMessage(`${format.toUpperCase()} copied. File sharing isn’t available here.`);
      }
    } catch {
      setMessage('Couldn’t export this kit. Please try again.');
    } finally {
      if (file?.exists) { try { file.delete(); } catch { /* Cache is disposable. */ } }
      inFlight.current = false;
      setBusy(false);
    }
  }
  return <View style={{ gap: 12, marginTop: 24 }}>
    <Text accessibilityRole="header" style={ui.heading}>Make it yours.</Text>
    <Text style={ui.body}>Take these colors into your next project.</Text>
    <ActionButton label="Copy kit" disabled={busy} onPress={() => void perform()} />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1 }}><ActionButton label="Export CSS" disabled={busy} onPress={() => void perform('css')} /></View>
      <View style={{ flex: 1 }}><ActionButton label="Export JSON" disabled={busy} onPress={() => void perform('json')} /></View>
    </View>
    {message && <Text accessibilityLiveRegion="polite" style={ui.body}>{message}</Text>}
  </View>;
}
