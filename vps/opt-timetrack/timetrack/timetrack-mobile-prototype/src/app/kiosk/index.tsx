import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KioskCameraMock } from '@/components/kiosk/KioskCameraMock';
import { KioskStatusPanel } from '@/components/kiosk/KioskStatusPanel';
import { Colors, Spacing } from '@/constants/theme';
import { MOCK_LOCATION } from '@/constants/mock-data';
import { useToastStore } from '@/store/useToastStore';
import type { KioskState, LivenessInstruction } from '@/types';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEV_STATES: { key: KioskState; label: string }[] = [
  { key: 'idle', label: 'idle' },
  { key: 'face_detected', label: 'face_detected' },
  { key: 'liveness', label: 'liveness' },
  { key: 'success', label: 'success' },
  { key: 'failed', label: 'failed' },
];

export default function KioskScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;
  const showToast = useToastStore((s) => s.show);

  const [state, setState] = useState<KioskState>('idle');
  const [instruction, setInstruction] = useState<LivenessInstruction>('look');
  const [now, setNow] = useState(() => format(new Date(), 'HH:mm:ss'));
  const sequenceId = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(format(new Date(), 'HH:mm:ss')), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const mySeq = ++sequenceId.current;

    if (state === 'liveness') {
      (async () => {
        const steps: LivenessInstruction[] = ['look', 'blink', 'turn_left', 'passed'];
        for (const step of steps) {
          setInstruction(step);
          await sleep(1100);
          if (sequenceId.current !== mySeq) return;
        }
        setState('success');
      })();
    }

    if (state === 'success') {
      (async () => {
        await sleep(4000);
        if (sequenceId.current !== mySeq) return;
        setState('idle');
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function setDevState(next: KioskState) {
    sequenceId.current += 1; // cancel any pending auto-sequence
    setInstruction('look');
    setState(next);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.locationName}>{MOCK_LOCATION.name}</Text>
          <Text style={styles.locationAddress}>{MOCK_LOCATION.address} · Терминал у входа</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <X color={Colors.text} size={20} />
        </Pressable>
      </View>

      <View style={[styles.body, { flexDirection: isWide ? 'row' : 'column' }]}>
        <KioskCameraMock state={state} instruction={instruction} />
        <View style={{ width: isWide ? Spacing.four : 0, height: isWide ? 0 : Spacing.four }} />
        <KioskStatusPanel
          state={state}
          time={now}
          onRetry={() => setDevState('idle')}
          onCallAdmin={() => showToast('Администратор уведомлён', 'info')}
        />
      </View>

      <View style={styles.devPanel}>
        <Text style={styles.devLabel}>Mock-controls (dev)</Text>
        <View style={styles.devRow}>
          {DEV_STATES.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.devChip, state === item.key && styles.devChipActive]}
              onPress={() => setDevState(item.key)}
            >
              <Text style={[styles.devChipText, state === item.key && styles.devChipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  locationName: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  locationAddress: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  devPanel: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  devLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: Spacing.two,
  },
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  devChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  devChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  devChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  devChipTextActive: {
    color: '#06111D',
  },
});
