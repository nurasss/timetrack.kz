import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colours, spacing } from '../../../../packages/shared/theme';

export type BadgeVariant = 'success' | 'error' | 'warning' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

/**
 * Small badge component used for statuses in history and requests.
 */
export function Badge({ label, variant = 'info' }: BadgeProps) {
  const backgroundColour = (() => {
    switch (variant) {
      case 'success':
        return colours.primary;
      case 'error':
        return colours.danger;
      case 'warning':
        return colours.warning;
      case 'info':
      default:
        return colours.info;
    }
  })();
  return (
    <View style={[styles.container, { backgroundColor: backgroundColour }]}> 
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colours.background,
    fontSize: 12,
    fontWeight: '500',
  },
});