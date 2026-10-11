import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colours, spacing } from '../../../../packages/shared/theme';
import type { CheckState } from '../../../../packages/shared/types';

export function FaceCameraMock({ state }: { state: CheckState }) {
  const isError = state === 'faceError' || state === 'livenessError';
  return (
    <View style={[styles.wrap, isError && styles.error]}>
      <View style={styles.faceFrame}>
        <View style={styles.head} />
        <View style={styles.shoulders} />
      </View>
      <View style={styles.scanLine} />
      <Text style={styles.label}>{isError ? 'Лицо не найдено' : 'Лицо найдено · 92%'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 250,
    borderRadius: 24,
    backgroundColor: '#08121F',
    borderWidth: 1,
    borderColor: colours.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  error: { borderColor: colours.danger },
  faceFrame: {
    width: 154,
    height: 184,
    borderRadius: 82,
    borderWidth: 2,
    borderColor: colours.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  head: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#23364C', marginBottom: 10 },
  shoulders: { width: 116, height: 54, borderRadius: 32, backgroundColor: '#1A2B40' },
  scanLine: { position: 'absolute', top: 82, left: 42, right: 42, height: 2, backgroundColor: colours.primary, opacity: 0.8 },
  label: { position: 'absolute', bottom: spacing.md, color: colours.textSecondary, fontWeight: '600' }
});
