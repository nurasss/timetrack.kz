import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { colours, spacing } from '../../../../packages/shared/theme';
import { useAppStore } from '../../store/useAppStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, employee, logout } = useAppStore();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileTop}>
          <Avatar name={employee?.full_name ?? user?.full_name ?? '—'} size={86} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{employee?.full_name ?? user?.full_name ?? '—'}</Text>
            <Text style={styles.position}>{user?.role ?? ''}</Text>
          </View>
        </View>
        <Card>
          <Text style={styles.sectionTitle}>Work info</Text>
          <Info label="Company" value={user?.company_name ?? '—'} />
          <Info label="Email" value={user?.email ?? employee?.email ?? '—'} />
          <Info label="Employee code" value={employee?.employee_code ?? '—'} />
          <Info label="Phone" value={employee?.phone ?? '—'} />
        </Card>
        <MenuItem icon="settings-outline" title="Settings" onPress={() => router.push('/settings')} />
        <MenuItem icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
        <MenuItem icon="cloud-offline-outline" title="Offline mode" onPress={() => router.push('/offline')} />
        <Button
          title="Log out"
          variant="secondary"
          onPress={async () => {
            await logout();
            router.replace('/login');
          }}
        />
      </ScrollView>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function MenuItem({ icon, title, onPress }: { icon: any; title: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.menuItem}>
        <Ionicons name={icon} size={22} color={colours.primary} />
        <Text style={styles.menuText}>{title}</Text>
        <Ionicons name="chevron-forward" size={20} color={colours.textSecondary} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  name: { color: colours.textPrimary, fontSize: 24, fontWeight: '900' },
  position: { color: colours.textSecondary, marginTop: 4 },
  sectionTitle: { color: colours.textPrimary, fontSize: 16, fontWeight: '900', marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  infoLabel: { color: colours.textSecondary },
  infoValue: { color: colours.textPrimary, fontWeight: '700', flex: 1, textAlign: 'right' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 18 },
  menuText: { color: colours.textPrimary, fontWeight: '800', flex: 1 }
});
