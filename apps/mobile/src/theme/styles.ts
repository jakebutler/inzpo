import { StyleSheet } from 'react-native';
import { CANVAS, fonts, INK, PAPER } from './tokens';

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CANVAS },
  content: { padding: 24, gap: 20, width: '100%', maxWidth: 600, alignSelf: 'center' },
  heading: { fontFamily: fonts.heading, color: INK, fontSize: 32, lineHeight: 44 },
  headerTitle: { fontFamily: fonts.heading, color: INK, fontSize: 22, lineHeight: 30 },
  briefLabel: { fontFamily: fonts.heading, color: INK, fontSize: 22, lineHeight: 30 },
  body: { fontFamily: fonts.body, color: INK, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.bodyMedium, color: INK, fontSize: 14, lineHeight: 20 },
  input: {
    fontFamily: fonts.body,
    fontSize: 17,
    color: INK,
    backgroundColor: PAPER,
    borderWidth: 1,
    borderColor: INK,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  message: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: INK, textAlign: 'center' },
});
