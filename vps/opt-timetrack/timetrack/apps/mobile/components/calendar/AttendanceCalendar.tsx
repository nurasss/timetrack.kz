import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui/Card';
import { colours, spacing } from '../../../../packages/shared/theme';

const days = Array.from({ length: 31 }, (_, index) => index + 1);
const statuses: Record<number, 'work' | 'weekend' | 'late' | 'absent' | 'leave'> = {
  1: 'weekend', 2: 'work', 3: 'work', 4: 'late', 5: 'work', 6: 'absent', 7: 'weekend',
  10: 'work', 11: 'late', 14: 'work', 16: 'work', 20: 'leave', 21: 'leave', 24: 'work', 28: 'weekend'
};

function colorFor(status?: string) {
  switch (status) {
    case 'work': return colours.primary;
    case 'late': return '#F97316';
    case 'absent': return colours.danger;
    case 'leave': return colours.info;
    case 'weekend': return colours.warning;
    default: return colours.border;
  }
}

export function AttendanceCalendar() {
  const [selected, setSelected] = useState(16);
  return (
    <>
      <Card style={styles.grid}>
        {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d) => <Text key={d} style={styles.weekday}>{d}</Text>)}
        {days.map((day) => (
          <Pressable key={day} onPress={() => setSelected(day)} style={[styles.day, selected === day && styles.selected]}>
            <Text style={styles.dayText}>{day}</Text>
            <View style={[styles.dot, { backgroundColor: colorFor(statuses[day]) }]} />
          </Pressable>
        ))}
      </Card>
      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.detailTitle}>Детали дня · {selected} мая</Text>
        <Text style={styles.detail}>Статус: {statuses[selected] === 'late' ? 'Опоздание' : statuses[selected] === 'absent' ? 'Отсутствие' : statuses[selected] === 'leave' ? 'Отпуск/командировка' : statuses[selected] === 'weekend' ? 'Выходной' : 'Рабочий день'}</Text>
        <Text style={styles.detail}>Приход: 08:56 · Уход: 18:07 · Отработано: 8 ч 57 мин</Text>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weekday: { width: '12.6%', textAlign: 'center', color: colours.textSecondary, fontSize: 12 },
  day: { width: '12.6%', aspectRatio: 1, borderRadius: 14, backgroundColor: '#0D1B2A', alignItems: 'center', justifyContent: 'center', gap: 3 },
  selected: { borderWidth: 1, borderColor: colours.primary },
  dayText: { color: colours.textPrimary, fontWeight: '600' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  detailTitle: { color: colours.textPrimary, fontWeight: '700', marginBottom: 8 },
  detail: { color: colours.textSecondary, marginTop: 4, fontSize: 13 }
});
