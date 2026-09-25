import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useToastStore } from '@/store/useToastStore';

const toneColor: Record<string, string> = {
  success: Colors.primary,
  error: Colors.error,
  info: Colors.info,
};

export function ToastHost() {
  const { message, tone } = useToastStore();

  if (!message) return null;

  return (
    <SafeAreaView style={styles.wrap} pointerEvents="none">
      <Text
        style={[styles.toast, { borderColor: toneColor[tone] }]}
        numberOfLines={2}
      >
        {message}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    marginTop: Spacing.two,
    marginHorizontal: Spacing.three,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
