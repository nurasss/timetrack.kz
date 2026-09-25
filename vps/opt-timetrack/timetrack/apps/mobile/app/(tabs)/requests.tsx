import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { RequestCard } from '../../components/requests/RequestCard';
import { colours, spacing } from '../../../../packages/shared/theme';
import { useAppStore } from '../../store/useAppStore';

const tabs = ['My requests', 'History'];

export default function RequestsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('My requests');
  const { employee, leaveRequests } = useAppStore();
  const items = leaveRequests.filter((item) => !employee || item.employee_id === employee.id || tab === 'History');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Requests</Text>
          <Button title="+ New" onPress={() => router.push('/request-form')} />
        </View>
        <View style={styles.tabs}>{tabs.map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.activeTab]}><Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item}</Text></Pressable>)}</View>
        {items.length ? items.map((request) => <RequestCard key={request.id} request={request} />) : <Text style={styles.empty}>No requests yet</Text>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  title: { color: colours.textPrimary, fontSize: 30, fontWeight: '900' },
  tabs: { flexDirection: 'row', backgroundColor: colours.card, padding: 5, borderRadius: 18, borderWidth: 1, borderColor: colours.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  activeTab: { backgroundColor: colours.primary },
  tabText: { color: colours.textSecondary, fontWeight: '800' },
  activeTabText: { color: colours.background },
  empty: { color: colours.textSecondary, textAlign: 'center', marginTop: 30 }
});
