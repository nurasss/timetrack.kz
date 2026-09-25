import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colours } from '../../../../packages/shared/theme';

interface AvatarProps {
  uri?: string | null;
  size?: number;
  name: string;
}

/**
 * Displays a circular avatar. If uri is provided, uses the image; otherwise
 * displays initials derived from the provided name.
 */
export function Avatar({ uri, size = 48, name }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);

  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colours.card,
        borderColor: colours.border,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colours.textPrimary, fontWeight: '600' }}>{initials}</Text>
    </View>
  );
}