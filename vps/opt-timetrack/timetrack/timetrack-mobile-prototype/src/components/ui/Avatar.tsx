import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

interface AvatarProps {
  initials: string;
  size?: number;
  online?: boolean;
}

export function Avatar({ initials, size = 48, online }: AvatarProps) {
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials}</Text>
      </View>
      {online && (
        <View
          style={[
            styles.dot,
            { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
  },
});
