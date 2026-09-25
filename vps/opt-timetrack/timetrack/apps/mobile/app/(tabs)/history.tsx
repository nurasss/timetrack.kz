import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { colours, spacing } from '../../../../packages/shared/theme';
import { useAppStore } from '../../store/useAppStore';

const tabs = ['Day', 'Week', 'Month'];

export default function HistoryScreen() {
  const [tab, setTab] = useState('Day');
  const { employee, attendance, locations } = useAppStore();
  const locationName = (id: string | null) => locations.find((location) => location.id === id)?.name ?? '—';
  const history = useMemo(
    () => attendance.filter((item) => !employee || item.employee_id === employee.id).slice(0, 20),
    [attendance, employee],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>History</Text>
        <View style={styles.tabs}>{tabs.map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.activeTab]}><Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item}</Text></Pressable>)}</View>
        <Card style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>Worked</Text>
            <Text style={styles.summaryValue}>8 h 57 m</Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>Late</Text>
            <Text style={[styles.summaryValue, { color: colours.primary }]}>none</Text>
          </View>
        </Card>
        {history.map((item) => (
          <Card key={item.id} style={styles.item}>
            <View style={styles.iconWrap}><Ionicons name={item.type === 'CHECK_IN' ? 'log-in' : 'log-out'} size={20} color={item.type === 'CHECK_IN' ? colours.primary : colours.danger} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.type === 'CHECK_IN' ? 'Check-in' : 'Check-out'} / {formatDate(item.marked_at)}</Text>
              <Text style={styles.itemSub}>{locationName(item.location_id)} / accuracy {item.accuracy_meters ?? 0} m / {sourceName(item.source)}</Text>
              {item.status === 'SUSPICIOUS' && <Badge label="Suspicious GPS" variant="warning" />}
            </View>
            <Text style={styles.itemTime}>{formatTime(item.marked_at)}</Text>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function formatTime(value: string) { return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
function formatDate(value: string) { return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }); }
function sourceName(source: string) { return source === 'TABLET' ? 'Tablet' : source === 'TERMINAL' ? 'Terminal' : 'Mobile'; }

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  title: { color: colours.textPrimary, fontSize: 30, fontWeight: '900' },
  tabs: { flexDirection: 'row', backgroundColor: colours.card, padding: 5, borderRadius: 18, borderWidth: 1, borderColor: colours.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  activeTab: { backgroundColor: colours.primary },
  tabText: { color: colours.textSecondary, fontWeight: '800' },
  activeTabText: { color: colours.background },
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colours.textSecondary, fontSize: 12 },
  summaryValue: { color: colours.textPrimary, fontSize: 20, fontWeight: '900', marginTop: 5 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#0B1623', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: colours.textPrimary, fontWeight: '900', marginBottom: 4 },
  itemSub: { color: colours.textSecondary, fontSize: 12, lineHeight: 17 },
  itemTime: { color: colours.textPrimary, fontWeight: '900' }
});
