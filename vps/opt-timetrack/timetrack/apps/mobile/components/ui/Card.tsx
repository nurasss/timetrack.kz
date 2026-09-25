import React, { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { colours, spacing } from '../../../../packages/shared/theme';

interface CardProps {
  children: ReactNode;
  style?: any;
}

/**
 * Basic card component with padding, rounded corners and a dark background.
 * Accepts custom style for overrides.
 */
export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colours.card,
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: spacing.md,
  },
});