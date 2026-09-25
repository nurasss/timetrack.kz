import { router } from 'expo-router';
import { ChevronLeft, CloudOff, RefreshCw } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Colors, Spacing } from '@/constants/theme';
import { useAttendanceStore } from '@/store/useAttendanceStore';
import { useToastStore } from '@/store/useToastStore';

export default function OfflineScreen() {
  const { pendingSyncCount, isSyncing, syncNow } = useAttendanceStore();
  const showToast = useToastStore((s) => s.show);

  async function handleSync() {
    await syncNow();
    showToast('Все отметки синхронизированы', 'success');
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <ChevronLeft color={Colors.text} size={22} />
        </Pressable>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.center}>
        <View style={styles.illustration}>
          <CloudOff color={Colors.textSecondary} size={56} strokeWidth={1.5} />
        </View>

        <Text style={styles.title}>Вы работаете офлайн</Text>
        <Text style={styles.desc}>
          Отметки сохраняются на устройстве и синхронизируются при восстановлении соединения.
        </Text>

        <Card style={styles.pendingCard}>
          <Text style={styles.pendingValue}>{pendingSyncCount}</Text>
          <Text style={styles.pendingLabel}>
            {pendingSyncCount === 0 ? 'Все отметки синхронизированы' : 'Ожидает синхронизации'}
          </Text>
        </Card>
      </View>

      <Button
        label={isSyncing ? 'Синхронизация…' : 'Синхронизировать сейчас'}
        size="lg"
        loading={isSyncing}
        disabled={pendingSyncCount === 0}
        icon={!isSyncing ? <RefreshCw color="#06111D" size={18} /> : undefined}
        onPress={handleSync}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: Spacing.two,
  },
  desc: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.four,
  },
  pendingCard: {
    alignItems: 'center',
    paddingHorizontal: Spacing.six,
  },
  pendingValue: {
    color: Colors.primary,
    fontSize: 32,
    fontWeight: '800',
  },
  pendingLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
});
