import React from 'react';
import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LocationStatusCard } from '../components/attendance/LocationStatusCard';
import { colours, spacing } from '../../../packages/shared/theme';
import { useAppStore } from '../store/useAppStore';

export default function CheckScreen() {
  const router = useRouter();
  const { attendance, checkState, positionError, offlineQueue, createAttendance } = useAppStore();

  const todayStr = new Date().toISOString().split('T')[0];
  const today = attendance.filter((item) => item.marked_at.startsWith(todayStr));
  const hasArrival = today.some((item) => item.type === 'CHECK_IN');
  const hasDeparture = today.some((item) => item.type === 'CHECK_OUT');

  const type = hasArrival && !hasDeparture ? 'CHECK_OUT' : 'CHECK_IN';
  const title = type === 'CHECK_IN' ? 'Отметка прихода' : 'Отметка ухода';
  const disabled = checkState === 'loading';

  const handleConfirm = async () => {
    try {
      await createAttendance(type);
      router.replace('/success');
    } catch (error: any) {
      Alert.alert('Отметка', error.message || 'Не удалось отправить отметку');
    }
  };

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={colours.textPrimary} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 42 }} />
        </View>

        <LocationStatusCard state={checkState} />
        <Card>
          <Text style={styles.sectionTitle}>Проверка местоположения</Text>
          <Text style={styles.instruction}>
            Приложение определяет ближайшую активную локацию и отправляет координаты на сервер. Сервер проверяет геозону, точность и последовательность отметок.
          </Text>
          {positionError ? <Text style={styles.error}>{positionError}</Text> : null}
          {offlineQueue.length > 0 ? (
            <Text style={styles.queue}>В очереди синхронизации: {offlineQueue.length}</Text>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Биометрия</Text>
          <Text style={styles.instruction}>
            В этой сборке нет подтверждённого конвейера распознавания лица. Для компаний с обязательным фото используйте планшет или ручную отметку с approval супервизора.
          </Text>
        </Card>

        <Button
          title={type === 'CHECK_IN' ? 'Подтвердить приход' : 'Подтвердить уход'}
          disabled={disabled}
          onPress={handleConfirm}
        />
        <Button title="Отмена" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: 70 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, height: 42, borderRadius: 15, backgroundColor: colours.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colours.border },
  title: { color: colours.textPrimary, fontSize: 23, fontWeight: '900' },
  sectionTitle: { color: colours.textPrimary, fontSize: 16, fontWeight: '900', marginBottom: 8 },
  instruction: { color: colours.textPrimary, fontSize: 14, lineHeight: 20 },
  error: { color: colours.danger, fontSize: 14, fontWeight: '700', marginTop: 8 },
  queue: { color: colours.textSecondary, fontSize: 13, marginTop: 8 },
});
