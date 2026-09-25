import { router } from 'expo-router';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Bell, ChevronRight, MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Colors, Spacing } from '@/constants/theme';
import { MOCK_EMPLOYEE, MOCK_SCHEDULE, MOCK_TODAY, MOCK_NOTIFICATIONS, MOCK_TODAY_RECORDS } from '@/constants/mock-data';
import { useAttendanceStore } from '@/store/useAttendanceStore';

export default function HomeScreen() {
  const { todayCheckIn, todayCheckOut } = useAttendanceStore();
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;
  const lastRecord = MOCK_TODAY_RECORDS[0];

  const isOnWork = !!todayCheckIn && !todayCheckOut;
  const statusLabel = todayCheckOut ? 'Рабочий день завершён' : isOnWork ? 'На работе' : 'Не отмечен';
  const statusTone: BadgeTone = todayCheckOut ? 'neutral' : isOnWork ? 'success' : 'warning';

  const dateLabel = format(MOCK_TODAY, 'd MMMM, EEEE', { locale: ru });

  function handleCta() {
    router.push(isOnWork ? '/check/out' : '/check/in');
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Главная</Text>
        <Pressable style={styles.bellBtn} onPress={() => router.push('/(tabs)/profile/notifications')}>
          <Bell color={Colors.text} size={20} />
          {unreadCount > 0 && (
            <View style={styles.bellDot}>
              <Text style={styles.bellDotText}>{unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Card style={styles.employeeCard}>
        <Avatar initials={MOCK_EMPLOYEE.avatarInitials} size={56} online={isOnWork} />
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{MOCK_EMPLOYEE.fullName}</Text>
          <Text style={styles.employeePosition}>{MOCK_EMPLOYEE.position}</Text>
          <View style={{ marginTop: Spacing.one }}>
            <Badge label={statusLabel} tone={statusTone} />
          </View>
        </View>
      </Card>

      <Text style={styles.sectionLabel}>Сегодня</Text>
      <Card style={{ marginBottom: Spacing.three }}>
        <Text style={styles.dateText}>{dateLabel}</Text>
        <View style={styles.scheduleRow}>
          <Text style={styles.scheduleLabel}>График</Text>
          <Text style={styles.scheduleValue}>{MOCK_SCHEDULE.startTime} — {MOCK_SCHEDULE.endTime}</Text>
        </View>
        <View style={styles.scheduleRow}>
          <Text style={styles.scheduleLabel}>Обед</Text>
          <Text style={styles.scheduleValue}>{MOCK_SCHEDULE.lunchStart} — {MOCK_SCHEDULE.lunchEnd}</Text>
        </View>
      </Card>

      <View style={styles.marksRow}>
        <Card style={styles.markCard}>
          <Text style={styles.markLabel}>Пришёл</Text>
          <Text style={[styles.markValue, todayCheckIn && { color: Colors.primary }]}>
            {todayCheckIn ?? '—'}
          </Text>
        </Card>
        <Card style={styles.markCard}>
          <Text style={styles.markLabel}>Ушёл</Text>
          <Text style={[styles.markValue, todayCheckOut && { color: Colors.error }]}>
            {todayCheckOut ?? '—'}
          </Text>
        </Card>
      </View>

      <Button
        label={isOnWork ? 'Отметить уход' : 'Отметить приход'}
        size="lg"
        variant={isOnWork ? 'danger' : 'primary'}
        onPress={handleCta}
        style={{ marginTop: Spacing.three, marginBottom: Spacing.four }}
      />

      {lastRecord && (
        <>
          <Text style={styles.sectionLabel}>Последняя отметка</Text>
          <Card>
            <View style={styles.lastRecordRow}>
              <View style={styles.lastRecordIcon}>
                <MapPin color={Colors.primary} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lastRecordType}>
                  {lastRecord.type === 'CHECK_IN' ? 'Приход' : 'Уход'} · {lastRecord.time}
                </Text>
                <Text style={styles.lastRecordLocation}>{lastRecord.locationName}</Text>
              </View>
              <Text style={styles.lastRecordAccuracy}>±{lastRecord.accuracyMeters} м</Text>
            </View>
          </Card>
        </>
      )}

      <Pressable style={styles.calendarLink} onPress={() => router.push('/calendar')}>
        <Text style={styles.calendarLinkText}>Открыть календарь посещаемости</Text>
        <ChevronRight color={Colors.textSecondary} size={16} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellDotText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  employeePosition: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: Spacing.two,
    textTransform: 'capitalize',
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
  },
  scheduleLabel: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  scheduleValue: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  marksRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  markCard: {
    flex: 1,
  },
  markLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  markValue: {
    color: Colors.textSecondary,
    fontSize: 20,
    fontWeight: '700',
  },
  lastRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  lastRecordIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastRecordType: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  lastRecordLocation: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  lastRecordAccuracy: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  calendarLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.four,
  },
  calendarLinkText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
