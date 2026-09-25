import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, LogIn, LogOut } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { MOCK_HISTORY } from '@/constants/mock-data';
import type { AttendanceRecord } from '@/types';

type Period = 'day' | 'week' | 'month';

const STATUS_LABEL: Record<AttendanceRecord['status'], string> = {
  OK: 'Вовремя',
  LATE: 'Опоздание',
  OUT_OF_GEOFENCE: 'Вне зоны',
  MANUAL_REVIEW: 'На проверке',
};

function formatWorked(minutes: number) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} ч ${m} мин`;
}

export default function HistoryScreen() {
  const [period, setPeriod] = useState<Period>('day');
  const [dayIndex, setDayIndex] = useState(0);
  const day = MOCK_HISTORY[dayIndex];

  const dateLabel = useMemo(
    () => format(parseISO(day.date), 'd MMMM, EEEE', { locale: ru }),
    [day.date]
  );

  return (
    <Screen scroll>
      <Text style={styles.title}>История</Text>

      <View style={styles.tabsRow}>
        {([
          ['day', 'День'],
          ['week', 'Неделя'],
          ['month', 'Месяц'],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.tab, period === key && styles.tabActive]}
            onPress={() => setPeriod(key)}
          >
            <Text style={[styles.tabText, period === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {period === 'day' ? (
        <>
          <View style={styles.dateNav}>
            <Pressable
              style={styles.dateNavBtn}
              disabled={dayIndex >= MOCK_HISTORY.length - 1}
              onPress={() => setDayIndex((i) => Math.min(i + 1, MOCK_HISTORY.length - 1))}
            >
              <ChevronLeft color={Colors.textSecondary} size={18} />
            </Pressable>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            <Pressable
              style={styles.dateNavBtn}
              disabled={dayIndex <= 0}
              onPress={() => setDayIndex((i) => Math.max(i - 1, 0))}
            >
              <ChevronRight color={Colors.textSecondary} size={18} />
            </Pressable>
          </View>

          <View style={{ gap: Spacing.two }}>
            {day.records.map((record) => (
              <Card key={record.id} style={styles.recordCard}>
                <View
                  style={[
                    styles.recordIcon,
                    { backgroundColor: record.type === 'CHECK_IN' ? Colors.primarySoft : Colors.errorSoft },
                  ]}
                >
                  {record.type === 'CHECK_IN' ? (
                    <LogIn color={Colors.primary} size={18} />
                  ) : (
                    <LogOut color={Colors.error} size={18} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.recordTopRow}>
                    <Text style={styles.recordType}>
                      {record.type === 'CHECK_IN' ? 'Приход' : 'Уход'} {record.time}
                    </Text>
                    {record.status !== 'OK' && (
                      <Badge label={STATUS_LABEL[record.status]} tone={record.status === 'LATE' ? 'warning' : 'error'} />
                    )}
                  </View>
                  <Text style={styles.recordMeta}>
                    {record.locationName} · точность {record.accuracyMeters} м
                  </Text>
                </View>
              </Card>
            ))}
          </View>

          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Отработано</Text>
              <Text style={styles.summaryValue}>{formatWorked(day.workedMinutes)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Опоздание</Text>
              <Text style={[styles.summaryValue, day.lateMinutes > 0 && { color: Colors.warning }]}>
                {day.lateMinutes > 0 ? `${day.lateMinutes} мин` : 'нет'}
              </Text>
            </View>
          </Card>
        </>
      ) : (
        <View style={{ gap: Spacing.two }}>
          {MOCK_HISTORY.map((d) => (
            <Card key={d.date} style={styles.compactRow}>
              <Text style={styles.compactDate}>
                {format(parseISO(d.date), 'd MMM', { locale: ru })}
              </Text>
              <Text style={styles.compactWorked}>{formatWorked(d.workedMinutes)}</Text>
              {d.lateMinutes > 0 ? (
                <Badge label={`+${d.lateMinutes} мин`} tone="warning" />
              ) : (
                <Badge label="Вовремя" tone="success" />
              )}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.three,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#06111D',
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  dateNavBtn: {
    padding: Spacing.two,
  },
  dateLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  recordIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordType: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  recordMeta: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  summaryCard: {
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  compactDate: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    width: 56,
    textTransform: 'capitalize',
  },
  compactWorked: {
    color: Colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
});
