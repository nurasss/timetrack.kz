import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { colours, spacing } from '../../../../packages/shared/theme';
import { useAppStore } from '../../store/useAppStore';

export default function HomeScreen() {
  const router = useRouter();
  const { user, attendance, refreshAttendance } = useAppStore();

  useEffect(() => {
    void refreshAttendance();
  }, [refreshAttendance]);

  const todayStr = new Date().toISOString().split('T')[0];
  const today = attendance.filter((item) => item.marked_at.startsWith(todayStr));
  const arrival = today.find((item) => item.type === 'CHECK_IN');
  const departure = today.find((item) => item.type === 'CHECK_OUT');
  const hasArrived = Boolean(arrival && !departure);
  const latest = attendance[0];

  if (!user) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={styles.title}>Загрузка...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Timetrack.kz</Text>
            <Text style={styles.title}>Главная</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={24} color={colours.textPrimary} />
            <View style={styles.redDot} />
          </Pressable>
        </View>

        <Card style={styles.employeeCard}>
          <View style={styles.employeeTop}>
            <Avatar name={user.full_name} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.employeeName}>{user.full_name}</Text>
              <Text style={styles.employeePosition}>{user.role === 'ADMIN' ? 'Администратор' : 'Сотрудник'}</Text>
            </View>
            <Badge label={hasArrived ? 'На работе' : 'Не отмечен'} variant={hasArrived ? 'success' : 'info'} />
          </View>
          <View style={styles.statusBar}>
            <View style={styles.statusLine} />
            <Text style={styles.statusText}>Компания: {user.company_name}</Text>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Сегодня</Text>
          <View style={styles.todayRow}>
            <Text style={styles.todayValue}>{formatDate(new Date())}</Text>
            <Text style={styles.todayBadge}>Смена</Text>
          </View>
          <Text style={styles.muted}>График: 09:00 — 18:00</Text>
          <Text style={styles.muted}>Обед: 13:00 — 14:00</Text>
        </Card>

        <View style={styles.timeCards}>
          <Card style={styles.timeCard}>
            <Text style={styles.smallLabel}>Пришел</Text>
            <Text style={styles.timeValue}>{arrival ? formatTime(arrival.marked_at) : '—'}</Text>
          </Card>
          <Card style={styles.timeCard}>
            <Text style={styles.smallLabel}>Ушел</Text>
            <Text style={[styles.timeValue, { color: colours.danger }]}>{departure ? formatTime(departure.marked_at) : '—'}</Text>
          </Card>
        </View>

        <Button title={hasArrived ? 'Отметить уход' : 'Отметить приход'} onPress={() => router.push('/check')} />

        <Card>
          <Text style={styles.sectionTitle}>Последняя отметка</Text>
          {latest ? (
            <View style={styles.lastRow}>
              <View style={styles.lastIcon}>
                <Ionicons name={latest.type === 'CHECK_IN' ? 'log-in' : 'log-out'} size={22} color={latest.type === 'CHECK_IN' ? colours.primary : colours.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lastTitle}>{latest.type === 'CHECK_IN' ? 'Приход' : 'Уход'} · {formatTime(latest.marked_at)}</Text>
                <Text style={styles.muted}>{latest.location || 'Офис'} · GPS {latest.accuracy_meters ?? 0} м · {latest.source}</Text>
              </View>
            </View>
          ) : <Text style={styles.muted}>Сегодня отметок нет</Text>}
        </Card>
      </View>
    </Screen>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date) {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', weekday: 'long' };
  return date.toLocaleDateString('ru-RU', options);
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  eyebrow: { color: colours.primary, fontWeight: '800', fontSize: 13 },
  title: { color: colours.textPrimary, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  iconButton: { width: 48, height: 48, borderRadius: 18, backgroundColor: colours.card, borderWidth: 1, borderColor: colours.border, alignItems: 'center', justifyContent: 'center' },
  redDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colours.danger },
  employeeCard: { gap: spacing.md },
  employeeTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  employeeName: { color: colours.textPrimary, fontSize: 20, fontWeight: '800' },
  employeePosition: { color: colours.textSecondary, marginTop: 3 },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colours.border },
  statusLine: { width: 24, height: 4, borderRadius: 2, backgroundColor: colours.primary },
  statusText: { color: colours.textSecondary, fontSize: 13 },
  sectionTitle: { color: colours.textPrimary, fontWeight: '800', fontSize: 16, marginBottom: 10 },
  todayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  todayValue: { color: colours.textPrimary, fontWeight: '700' },
  todayBadge: { color: colours.primary, fontWeight: '800' },
  muted: { color: colours.textSecondary, fontSize: 13, lineHeight: 19 },
  timeCards: { flexDirection: 'row', gap: spacing.md },
  timeCard: { flex: 1 },
  smallLabel: { color: colours.textSecondary, marginBottom: 8 },
  timeValue: { color: colours.primary, fontSize: 24, fontWeight: '900' },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lastIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#0B1623', alignItems: 'center', justifyContent: 'center' },
  lastTitle: { color: colours.textPrimary, fontWeight: '800', marginBottom: 3 }
});
