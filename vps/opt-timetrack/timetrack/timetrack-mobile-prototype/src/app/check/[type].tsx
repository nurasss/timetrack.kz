import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { X } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { FaceCameraMock } from '@/components/attendance/FaceCameraMock';
import { LocationStatusCard } from '@/components/attendance/LocationStatusCard';
import { ProgressSteps } from '@/components/attendance/ProgressSteps';
import { Colors, Spacing } from '@/constants/theme';
import { MOCK_LOCATION } from '@/constants/mock-data';
import { useAttendanceStore } from '@/store/useAttendanceStore';
import type { CheckFlowState, CheckStep, LivenessInstruction } from '@/types';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STEP_BY_PHASE: Record<CheckFlowState, { step: CheckStep; error?: boolean }> = {
  loading: { step: 'geolocation' },
  geofence_error: { step: 'geolocation', error: true },
  geofence_ok: { step: 'face' },
  face_scanning: { step: 'face' },
  face_error: { step: 'face', error: true },
  liveness: { step: 'liveness' },
  liveness_error: { step: 'liveness', error: true },
  success: { step: 'done' },
};

export default function CheckScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const isCheckIn = type !== 'out';

  const [phase, setPhase] = useState<CheckFlowState>('loading');
  const [instruction, setInstruction] = useState<LivenessInstruction>('look');
  const [runId, setRunId] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const cancelRef = useRef(false);

  const markCheckIn = useAttendanceStore((s) => s.markCheckIn);
  const markCheckOut = useAttendanceStore((s) => s.markCheckOut);

  useEffect(() => {
    cancelRef.current = false;
    runHappyPath();
    return () => {
      cancelRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  async function runHappyPath() {
    setPhase('loading');
    await sleep(1100);
    if (cancelRef.current) return;
    setPhase('geofence_ok');
    await sleep(1100);
    if (cancelRef.current) return;
    setPhase('face_scanning');
    await sleep(1200);
    if (cancelRef.current) return;
    setPhase('liveness');
    setInstruction('look');
    await sleep(1100);
    if (cancelRef.current) return;
    setInstruction('blink');
    await sleep(1100);
    if (cancelRef.current) return;
    setInstruction('turn_left');
    await sleep(1100);
    if (cancelRef.current) return;
    setInstruction('passed');
  }

  function simulateError(errorPhase: CheckFlowState) {
    cancelRef.current = true;
    setPhase(errorPhase);
  }

  function retry() {
    setRunId((id) => id + 1);
  }

  async function handleConfirm() {
    setSubmitting(true);
    const now = format(new Date(), 'HH:mm');
    await sleep(500);
    if (isCheckIn) markCheckIn(now);
    else markCheckOut(now);
    router.replace({ pathname: '/check/success', params: { type: isCheckIn ? 'in' : 'out', time: now } });
  }

  const ready = phase === 'liveness' && instruction === 'passed';
  const { step, error: stepError } = STEP_BY_PHASE[phase];

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>{isCheckIn ? 'Отметка прихода' : 'Отметка ухода'}</Text>
        <Button label="" icon={<X color={Colors.text} size={18} />} variant="ghost" onPress={() => router.back()} style={styles.closeBtn} />
      </View>

      <LocationStatusCard
        status={phase === 'loading' ? 'loading' : phase === 'geofence_error' ? 'error' : 'ok'}
      />

      {phase === 'geofence_error' ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>
            Вы находитесь за пределами геозоны «{MOCK_LOCATION.name}». Подойдите ближе к офису и попробуйте снова.
          </Text>
          <Button label="Повторить" variant="secondary" onPress={retry} />
        </View>
      ) : (
        <>
          <FaceCameraMock
            state={
              phase === 'face_error' ? 'error'
                : phase === 'face_scanning' ? 'scanning'
                : phase === 'liveness' || phase === 'liveness_error' ? (phase === 'liveness_error' ? 'error' : 'liveness')
                : 'idle'
            }
            instruction={instruction}
          />

          {phase === 'face_error' && (
            <View style={styles.errorBlock}>
              <Button label="Повторить" variant="secondary" onPress={retry} />
            </View>
          )}

          {phase === 'liveness_error' && (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>Проверка не пройдена. Попробуйте ещё раз</Text>
              <Button label="Повторить" variant="secondary" onPress={retry} />
            </View>
          )}

          <ProgressSteps current={step} hasError={stepError} />

          <Button
            label={isCheckIn ? 'Подтвердить приход' : 'Подтвердить уход'}
            size="lg"
            loading={submitting}
            disabled={!ready}
            onPress={handleConfirm}
            style={{ marginTop: Spacing.two }}
          />
          <Button
            label="Отмена"
            variant="ghost"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.two, marginBottom: Spacing.four }}
          />
        </>
      )}

      {phase !== 'geofence_error' && (
        <View style={styles.devBlock}>
          <Text style={styles.devLabel}>Демо ошибок</Text>
          <View style={styles.devRow}>
            <Button label="Вне зоны" variant="ghost" onPress={() => simulateError('geofence_error')} />
            <Button label="Лицо не найдено" variant="ghost" onPress={() => simulateError('face_error')} />
            <Button label="Liveness — ошибка" variant="ghost" onPress={() => simulateError('liveness_error')} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  title: {
    color: Colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  closeBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  errorBlock: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    lineHeight: 18,
  },
  devBlock: {
    marginTop: Spacing.two,
    marginBottom: Spacing.five,
  },
  devLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: Spacing.one,
  },
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
});
