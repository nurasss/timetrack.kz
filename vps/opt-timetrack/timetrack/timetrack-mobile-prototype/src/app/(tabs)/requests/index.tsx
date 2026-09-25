import { useState } from 'react';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { RequestCard } from '@/components/requests/RequestCard';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRequestsStore } from '@/store/useRequestsStore';

type Tab = 'active' | 'history';

export default function RequestsScreen() {
  const [tab, setTab] = useState<Tab>('active');
  const requests = useRequestsStore((s) => s.requests);

  const filtered = requests.filter((r) =>
    tab === 'active' ? r.status === 'PENDING' : r.status !== 'PENDING'
  );

  return (
    <Screen scroll>
      <Text style={styles.title}>Заявки</Text>

      <View style={styles.tabsRow}>
        {([
          ['active', 'Мои заявки'],
          ['history', 'История'],
        ] as const).map(([key, label]) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: Spacing.two, marginBottom: Spacing.four }}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>Заявок пока нет</Text>
        ) : (
          filtered.map((r) => <RequestCard key={r.id} request={r} />)
        )}
      </View>

      <Button
        label="Новая заявка"
        size="lg"
        icon={<Plus color="#06111D" size={18} />}
        onPress={() => router.push('/(tabs)/requests/new')}
      />
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
  empty: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
