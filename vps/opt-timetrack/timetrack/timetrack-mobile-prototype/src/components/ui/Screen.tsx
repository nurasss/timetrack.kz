import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function Screen({ children, scroll = false, padded = true, edges = ['top', 'bottom'] }: ScreenProps) {
  const content = padded ? <View style={styles.padded}>{children}</View> : children;

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={padded ? styles.scrollPadded : undefined}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  padded: {
    flex: 1,
    paddingHorizontal: Spacing.three,
  },
  scrollPadded: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
});
