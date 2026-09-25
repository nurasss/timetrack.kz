import React from 'react';
import { TouchableOpacity, Text, StyleSheet, GestureResponderEvent } from 'react-native';
import { colours, spacing } from '../../../../packages/shared/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}

/**
 * Reusable button component supporting three variants: primary, secondary and ghost.
 * Primary buttons use the brand colour, secondary buttons use the card colour
 * and ghost buttons are transparent with a subtle border.
 */
export function Button({ title, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const backgroundColor = (() => {
    switch (variant) {
      case 'primary':
        return colours.primary;
      case 'secondary':
        return colours.card;
      case 'ghost':
        return 'transparent';
      default:
        return colours.primary;
    }
  })();

  const borderColor = variant === 'ghost' ? colours.border : 'transparent';
  const textColour = variant === 'primary' ? colours.background : colours.textPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor, borderColor, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <Text style={[styles.text, { color: textColour }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});