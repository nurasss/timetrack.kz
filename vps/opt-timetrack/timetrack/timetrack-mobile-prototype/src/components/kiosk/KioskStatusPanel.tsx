import { CheckCircle2, Clock, ScanFace, UserX } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { MOCK_EMPLOYEE } from '@/constants/mock-data';
import type { KioskState } from '@/types';

interface KioskStatusPanelProps {
  state: KioskState;
  time: string;
  onRetry: () => void;
  onCallAdmin: () => void;
}

export function KioskStatusPanel({ state, time, onRetry, onCallAdmin }: KioskStatusPanelProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.clockRow}>
        <Clock color={Colors.textMuted} size={16} />
        <Text style={styles.clockText}>{time}</Text>
      </View>

      <View style={styles.content}>
        {state === 'idle' && (
          <>
            <View style={[styles.statusIcon, { backgroundColor: Colors.cardAlt }]}>
              <ScanFace color={Colors.textSecondary} size={32} />
            </View>
            <Text style={styles.title}>Ожидание сотрудника</Text>
            <Text style={styles.subtitle}>Подойдите к терминалу, чтобы отметить приход или уход</Text>
          </>
        )}

        {(state === 'face_detected' || state === 'liveness') && (
          <>
            <View style={[styles.statusIcon, { backgroundColor: Colors.primarySoft }]}>
              <ScanFace color={Colors.primary} size={32} />
            </View>
            <Text style={styles.title}>{MOCK_EMPLOYEE.fullName}</Text>
            <Text style={styles.subtitle}>{MOCK_EMPLOYEE.position}</Text>
          </>
        )}

        {state === 'success' && (
          <>
            <View style={[styles.statusIcon, { backgroundColor: Colors.primarySoft }]}>
              <CheckCircle2 color={Colors.primary} size={36} />
            </View>
            <Text style={styles.title}>{MOCK_EMPLOYEE.fullName}</Text>
            <Text style={styles.successLine}>Приход отмечен</Text>
            <Text style={styles.successTime}>{time}</Text>
            <Text style={styles.welcome}>Добро пожаловать!</Text>
          </>
        )}

        {state === 'failed' && (
          <>
            <View style={[styles.statusIcon, { backgroundColor: Colors.errorSoft }]}>
              <UserX color={Colors.error} size={32} />
            </View>
            <Text style={[styles.title, { color: Colors.error }]}>Сотрудник не найден</Text>
            <Text style={styles.subtitle}>Попробуйте ещё раз или обратитесь к администратору</Text>
            <View style={{ width: '100%', gap: Spacing.two, marginTop: Spacing.four }}>
              <Button label="Попробовать снова" onPress={onRetry} />
              <Button label="Позвать администратора" variant="secondary" onPress={onCallAdmin} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.four,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
  },
  clockText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  successLine: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  successTime: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginTop: Spacing.one,
  },
  welcome: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: Spacing.three,
  },
});
