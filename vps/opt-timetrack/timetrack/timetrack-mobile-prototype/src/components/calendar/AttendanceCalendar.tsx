import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { CalendarDay, CalendarDayStatus } from '@/types';

export const STATUS_COLOR: Record<CalendarDayStatus, string> = {
  work: Colors.primary,
  weekend: '#FBBF24',
  late: '#F97316',
  absent: Colors.error,
  leave: Colors.info,
};

export const STATUS_LABEL: Record<CalendarDayStatus, string> = {
  work: 'Рабочий день',
  weekend: 'Выходной',
  late: 'Опоздание',
  absent: 'Отсутствие',
  leave: 'Отпуск',
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface AttendanceCalendarProps {
  days: CalendarDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function AttendanceCalendar({ days, selectedDate, onSelectDate }: AttendanceCalendarProps) {
  const firstDow = (new Date(days[0].date).getDay() + 6) % 7; // 0 = Monday
  const leadingBlanks = Array.from({ length: firstDow });

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {leadingBlanks.map((_, i) => (
          <View key={`blank-${i}`} style={styles.cell} />
        ))}
        {days.map((day) => {
          const dayNum = new Date(day.date).getDate();
          const isSelected = day.date === selectedDate;
          return (
            <Pressable key={day.date} style={styles.cell} onPress={() => onSelectDate(day.date)}>
              <View style={[styles.cellInner, isSelected && styles.cellSelected]}>
                <Text style={[styles.cellText, isSelected && styles.cellTextSelected]}>{dayNum}</Text>
                <View style={[styles.dot, { backgroundColor: STATUS_COLOR[day.status] }]} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        {(Object.keys(STATUS_LABEL) as CalendarDayStatus[]).map((status) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR[status] }]} />
            <Text style={styles.legendText}>{STATUS_LABEL[status]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: {
    flexDirection: 'row',
    marginBottom: Spacing.two,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInner: {
    width: '82%',
    height: '82%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  cellSelected: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  cellText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  cellTextSelected: {
    color: Colors.text,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
});
