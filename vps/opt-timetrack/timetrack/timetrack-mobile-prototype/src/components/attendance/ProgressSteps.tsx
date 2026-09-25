import { Check } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { CheckStep } from '@/types';

const STEPS: { key: CheckStep; label: string }[] = [
  { key: 'geolocation', label: 'Геолокация' },
  { key: 'face', label: 'Лицо найдено' },
  { key: 'liveness', label: 'Liveness' },
  { key: 'done', label: 'Готово' },
];

interface ProgressStepsProps {
  current: CheckStep;
  hasError?: boolean;
}

export function ProgressSteps({ current, hasError }: ProgressStepsProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <View style={styles.row}>
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        const dotColor = hasError && isActive ? Colors.error : isDone || isActive ? Colors.primary : Colors.border;

        return (
          <View key={step.key} style={styles.stepWrap}>
            <View style={styles.stepRow}>
              <View style={[styles.dot, { backgroundColor: isDone ? Colors.primary : 'transparent', borderColor: dotColor }]}>
                {isDone && <Check color="#06111D" size={11} strokeWidth={3} />}
              </View>
              {index < STEPS.length - 1 && (
                <View style={[styles.line, { backgroundColor: isDone ? Colors.primary : Colors.border }]} />
              )}
            </View>
            <Text style={[styles.label, (isDone || isActive) && styles.labelActive]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: Spacing.three,
  },
  stepWrap: {
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    height: 2,
  },
  label: {
    marginTop: 6,
    fontSize: 10,
    color: Colors.textMuted,
  },
  labelActive: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
