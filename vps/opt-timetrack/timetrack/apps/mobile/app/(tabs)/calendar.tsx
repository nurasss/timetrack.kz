import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { AttendanceCalendar } from '../../components/calendar/AttendanceCalendar';
import { colours, spacing } from '../../../../packages/shared/theme';

export default function CalendarScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Календарь</Text>
        <Text style={styles.month}>Май 2024</Text>
        <AttendanceCalendar />
        <View style={styles.legend}>
          <Legend color={colours.primary} label="Рабочий день" />
          <Legend color={colours.warning} label="Выходной" />
          <Legend color="#F97316" label="Опоздание" />
          <Legend color={colours.danger} label="Отсутствие" />
          <Legend color={colours.info} label="Отпуск/командировка" />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  title: { color: colours.textPrimary, fontSize: 30, fontWeight: '900' },
  month: { color: colours.textSecondary, fontSize: 17, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: colours.textSecondary, fontSize: 12 }
});
