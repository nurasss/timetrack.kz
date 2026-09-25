import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { colours, spacing } from '../../../packages/shared/theme';
import { useAppStore } from '../store/useAppStore';

export default function NotificationsScreen() {
  const router = useRouter();
  const { attendance, offlineQueue } = useAppStore();
  const suspicious = attendance.filter((item) => item.status === 'SUSPICIOUS').slice(0, 10);
  const items = [
    ...offlineQueue.map((item) => ({
      id: `queue-${item.eventId}`,
      icon: 'sync' as const,
      title: 'Ожидает подтверждения сервера',
      message: `${item.type === 'CHECK_IN' ? 'Приход' : 'Уход'} от ${new Date(item.markedAt).toLocaleString('ru-RU')}`,
    })),
    ...suspicious.map((item) => ({
      id: `mark-${item.id}`,
      icon: 'alert-circle' as const,
      title: 'Отметка требует проверки',
      message: `${item.type === 'CHECK_IN' ? 'Приход' : 'Уход'} от ${new Date(item.marked_at).toLocaleString('ru-RU')}`,
    })),
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colours.textPrimary} /></Pressable>
          <Text style={styles.title}>Notifications</Text>
          <View style={{ width: 42 }} />
        </View>
        {items.length ? items.map((item) => (
          <Card key={item.id} style={styles.item}>
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon} size={23} color={colours.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemText}>{item.message}</Text>
            </View>
          </Card>
        )) : <Text style={styles.empty}>Уведомлений нет</Text>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: 70 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, height: 42, borderRadius: 15, backgroundColor: colours.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colours.border },
  title: { color: colours.textPrimary, fontSize: 24, fontWeight: '900' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconCircle: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colours.primary}22` },
  itemTitle: { color: colours.textPrimary, fontWeight: '900', marginBottom: 4 },
  itemText: { color: colours.textSecondary, fontSize: 13, lineHeight: 18 },
  empty: { color: colours.textSecondary, textAlign: 'center', marginTop: 30 }
});
