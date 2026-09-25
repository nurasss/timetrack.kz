import { useState } from 'react';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { AttendanceCalendar, STATUS_COLOR, STATUS_LABEL } from '@/components/calendar/AttendanceCalendar';
import { Colors, Spacing } from '@/constants/theme';
import { MOCK_CALENDAR } from '@/constants/mock-data';
import { useToastStore } from '@/store/useToastStore';

export default function CalendarScreen() {
  const showToast = useToastStore((s) => s.show);
  const [selectedDate, setSelectedDate] = useState(MOCK_CALENDAR[MOCK_CALENDAR.length - 1].date);

  const selectedDay = MOCK_CALENDAR.find((d) => d.date === selectedDate) ?? MOCK_CALENDAR[0];
  const monthLabel = format(parseISO(MOCK_CALENDAR[0].date), 'LLLL yyyy', { locale: ru });

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={Colors.text} size={22} />
        </Pressable>
        <Text style={styles.title}>Календарь</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.monthRow}>
        <Pressable onPress={() => showToast('В прототипе доступен только текущий месяц', 'info')}>
          <ChevronLeft color={Colors.textMuted} size={18} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => showToast('В прототипе доступен только текущий месяц', 'info')}>
          <ChevronLeft color={Colors.textMuted} size={18} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
      </View>

      <Card>
        <AttendanceCalendar days={MOCK_CALENDAR} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      </Card>

      <Card style={styles.detailCard}>
        <Text style={styles.detailDate}>
          {format(parseISO(selectedDay.date), 'd MMMM, EEEE', { locale: ru })}
        </Text>
        <View style={styles.detailRow}>
          <View style={[styles.detailDot, { backgroundColor: STATUS_COLOR[selectedDay.status] }]} />
          <Text style={styles.detailStatus}>{STATUS_LABEL[selectedDay.status]}</Text>
        </View>
        {selectedDay.note && <Text style={styles.detailNote}>{selectedDay.note}</Text>}
      </Card>
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
  backBtn: {
    width: 22,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    marginBottom: Spacing.three,
  },
  monthLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  detailCard: {
    marginTop: Spacing.three,
    marginBottom: Spacing.five,
  },
  detailDate: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: Spacing.two,
    textTransform: 'capitalize',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  detailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailStatus: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  detailNote: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: Spacing.one,
  },
});
