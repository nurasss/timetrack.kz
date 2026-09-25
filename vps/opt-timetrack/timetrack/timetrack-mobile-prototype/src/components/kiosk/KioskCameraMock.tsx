import { ScanFace, UserX } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { MOCK_EMPLOYEE } from '@/constants/mock-data';
import type { KioskState, LivenessInstruction } from '@/types';

const LIVENESS_TEXT: Record<LivenessInstruction, string> = {
  look: 'Посмотрите прямо',
  blink: 'Моргните',
  turn_left: 'Поверните голову налево',
  passed: 'Проверка пройдена',
};

interface KioskCameraMockProps {
  state: KioskState;
  instruction: LivenessInstruction;
}

export function KioskCameraMock({ state, instruction }: KioskCameraMockProps) {
  const showFace = state === 'face_detected' || state === 'liveness' || state === 'success';
  const frameColor = state === 'failed' ? Colors.error : state === 'success' ? Colors.primary : Colors.primary;

  return (
    <View style={styles.wrap}>
      <View style={styles.scanArea}>
        {showFace ? (
          <View style={[styles.faceFrame, { borderColor: frameColor }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{MOCK_EMPLOYEE.avatarInitials}</Text>
            </View>
          </View>
        ) : state === 'failed' ? (
          <View style={styles.idleIcon}>
            <UserX color={Colors.error} size={56} strokeWidth={1.5} />
          </View>
        ) : (
          <View style={styles.idleIcon}>
            <ScanFace color={Colors.textMuted} size={56} strokeWidth={1.5} />
          </View>
        )}
      </View>

      <Text style={styles.caption}>
        {state === 'idle' && 'Подойдите к камере для отметки'}
        {state === 'face_detected' && 'Лицо обнаружено, не двигайтесь'}
        {state === 'liveness' && LIVENESS_TEXT[instruction]}
        {state === 'success' && 'Распознавание завершено'}
        {state === 'failed' && 'Сотрудник не найден'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1.4,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  scanArea: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceFrame: {
    width: 260,
    height: 260,
    borderRadius: Radius.xl,
    borderWidth: 4,
    backgroundColor: Colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.primary,
    fontSize: 52,
    fontWeight: '700',
  },
  idleIcon: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    marginTop: Spacing.four,
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
