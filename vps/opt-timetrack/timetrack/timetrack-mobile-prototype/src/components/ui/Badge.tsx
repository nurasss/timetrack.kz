import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type BadgeTone = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const palette = palettes[tone];
  return (
    <View style={[styles.base, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const palettes: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: Colors.primarySoft, fg: Colors.primary },
  error: { bg: Colors.errorSoft, fg: Colors.error },
  warning: { bg: Colors.warningSoft, fg: Colors.warning },
  info: { bg: Colors.infoSoft, fg: Colors.info },
  neutral: { bg: Colors.cardAlt, fg: Colors.textSecondary },
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
