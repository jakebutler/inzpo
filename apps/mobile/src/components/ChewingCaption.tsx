import { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';
import { fonts, INK } from '@/theme/tokens';

/** Mount only while waiting; fast requests never flash a status caption. */
export function ChewingCaption({ style }: { style?: TextStyle }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  return visible ? <Text allowFontScaling accessibilityLiveRegion="polite"
    style={[{ fontFamily: fonts.hand, fontSize: 17, lineHeight: 24, color: INK }, style]}>Chewing on it.</Text> : null;
}
