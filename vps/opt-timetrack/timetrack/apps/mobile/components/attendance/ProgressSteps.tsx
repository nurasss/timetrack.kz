import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours } from '../../../../packages/shared/theme';
import type { CheckState } from '../../../../packages/shared/types';

const labels = ['Геолокация', 'Лицо', 'Liveness', 'Готово'];

export function ProgressSteps({ state }: { state: CheckState }) {
  const activeIndex = state === 'success' ? 3 : state === 'livenessError' ? 2 : state === 'faceError' ? 1 : state === 'geoError' ? 0 : 2;
  return (
    <View style={styles.row}>
      {labels.map((label, index) => {
        const done = index <= activeIndex && !state.includes('Error');
        const isError = index === activeIndex && state.includes('Error');
        return (
          <View key={label} style={styles.item}>
            <View style={[styles.circle, done && styles.done, isError && styles.error]}>
              <Ionicons name={done ? 'checkmark' : isError ? 'close' : 'ellipse'} size={14} color={done || isError ? '#071421' : colours.textSecondary} />
            </View>
            <Text style={styles.label}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  item: { alignItems: 'center', flex: 1, gap: 6 },
  circle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colours.border, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colours.primary, borderColor: colours.primary },
  error: { backgroundColor: colours.danger, borderColor: colours.danger },
  label: { color: colours.textSecondary, fontSize: 10 }
});
