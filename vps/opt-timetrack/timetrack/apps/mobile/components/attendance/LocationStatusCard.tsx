import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { colours, spacing } from '../../../../packages/shared/theme';
import type { CheckState } from '../../../../packages/shared/types';

export function LocationStatusCard({ state }: { state: CheckState }) {
  const error = state === 'geoError';
  return (
    <Card style={[styles.card, error && styles.errorCard]}>
      <View style={styles.iconCircle}>
        <Ionicons name={error ? 'close' : 'checkmark'} size={22} color={error ? colours.danger : colours.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, error && { color: colours.danger }]}>{error ? 'Геопроверка не пройдена' : 'Геопозиция получена'}</Text>
        <Text style={styles.sub}>Сервер выбирает ближайшую активную локацию и проверяет геозону.</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  errorCard: { borderColor: colours.danger },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colours.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: { color: colours.textPrimary, fontSize: 15, fontWeight: '700' },
  sub: { color: colours.textSecondary, marginTop: 4, fontSize: 12, lineHeight: 17 }
});
