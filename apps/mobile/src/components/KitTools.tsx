import { copyKitText, exportKitText, exportKitFilename, type ExportFormat, type MobileKit } from '@inzpo/shared';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ActionButton } from './ActionButton';
import { haptics } from '@/lib/haptics';
import { ui } from '@/theme/styles';

export function KitTools({ kit, compact = false, descriptionFailed = false, onBusyChange }: { kit: MobileKit; compact?: boolean; descriptionFailed?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<'copy' | ExportFormat | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { onBusyChange?.(busy !== null); }, [busy, onBusyChange]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 3000); return () => clearTimeout(timer); }, [copied]);
  const [message, setMessage] = useState<string | null>(null);
  async function perform(format?: ExportFormat) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(format ?? 'copy');
    setCopied(false);
    setMessage(null);
    let file: File | undefined;
    try {
      if (!format) {
        await Clipboard.setStringAsync(copyKitText(kit));
        setCopied(true);
        setMessage(!descriptionFailed && kit.brief.status === 'ready' && kit.brief.text ? 'Kit copied. Make something with it.'
          : !descriptionFailed && kit.brief.status === 'pending' ? 'Colors copied. The description is still on its way.' : 'Colors copied. The description is unavailable.');
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
      setMessage(format ? 'Couldn’t prepare this file. Please try again.' : 'Couldn’t copy this kit. Please try again.');
      void haptics.error();
    } finally {
      if (file?.exists) { try { file.delete(); } catch { /* Cache is disposable. */ } }
      inFlight.current = false;
      setBusy(null);
    }
  }
  const briefNote = !descriptionFailed && kit.brief.status === 'pending' ? 'Colors are ready to use. The description is still on its way.'
    : descriptionFailed || kit.brief.status === 'failed' || !kit.brief.text ? 'Colors are ready to use. The description is unavailable.'
    : compact ? 'Your colors and description, ready to make with.' : 'Copy the colors and description, or take a file into your project.';
  return <View style={{ gap: 12, marginTop: compact ? 0 : 24 }}>
    {!compact && <Text accessibilityRole="header" style={ui.heading}>Make it yours.</Text>}
    <Text style={ui.body}>{briefNote}</Text>
    <ActionButton label={busy === 'copy' ? 'Copying…' : copied ? 'Copied' : 'Copy kit'} primary={compact} disabled={busy !== null} onPress={() => void perform()} />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1 }}><ActionButton label={busy === 'css' ? 'Preparing CSS…' : 'Export CSS'} disabled={busy !== null} onPress={() => void perform('css')} /></View>
      <View style={{ flex: 1 }}><ActionButton label={busy === 'json' ? 'Preparing JSON…' : 'Export JSON'} disabled={busy !== null} onPress={() => void perform('json')} /></View>
    </View>
    <View style={{ minHeight: 48 }}><Text accessibilityLiveRegion="polite" style={ui.body}>{message ?? ' '}</Text></View>
  </View>;
}
