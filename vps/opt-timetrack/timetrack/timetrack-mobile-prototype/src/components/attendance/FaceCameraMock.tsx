import { AlertTriangle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { MOCK_EMPLOYEE } from '@/constants/mock-data';
import type { LivenessInstruction } from '@/types';

const LIVENESS_TEXT: Record<LivenessInstruction, string> = {
  look: 'Посмотрите в камеру',
  blink: 'Моргните',
  turn_left: 'Поверните голову налево',
  passed: 'Проверка пройдена',
};

interface FaceCameraMockProps {
  state: 'scanning' | 'liveness' | 'error' | 'idle';
  instruction?: LivenessInstruction;
}

export function FaceCameraMock({ state, instruction }: FaceCameraMockProps) {
  const frameColor = state === 'error' ? Colors.error : Colors.primary;

  return (
    <View style={styles.wrap}>
      <View style={[styles.frame, { borderColor: frameColor }]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{MOCK_EMPLOYEE.avatarInitials}</Text>
        </View>
        {state === 'error' && (
          <View style={styles.errorBadge}>
            <AlertTriangle color={Colors.white} size={14} />
          </View>
        )}
      </View>

      <Text style={[styles.caption, state === 'error' && { color: Colors.error }]}>
        {state === 'error' && 'Лицо не найдено'}
        {state === 'scanning' && 'Ищем лицо…'}
        {state === 'liveness' && instruction && LIVENESS_TEXT[instruction]}
        {state === 'idle' && 'Наведите камеру на лицо'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginVertical: Spacing.three,
  },
  frame: {
    width: 200,
    height: 200,
    borderRadius: Radius.xl,
    borderWidth: 3,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: Colors.primary,
    fontSize: 36,
    fontWeight: '700',
  },
  errorBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    marginTop: Spacing.three,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
