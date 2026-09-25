import { router } from 'expo-router';
import {
  AlertTriangle, ChevronLeft, CheckCircle2, RefreshCw, Sparkles, Bell,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Colors, Spacing } from '@/constants/theme';
import { MOCK_NOTIFICATIONS } from '@/constants/mock-data';
import type { NotificationKind } from '@/types';

const KIND_META: Record<NotificationKind, { icon: typeof Bell; color: string; bg: string }> = {
  late: { icon: AlertTriangle, color: Colors.warning, bg: Colors.warningSoft },
  approved: { icon: CheckCircle2, color: Colors.primary, bg: Colors.primarySoft },
  reminder: { icon: Bell, color: Colors.info, bg: Colors.infoSoft },
  sync: { icon: RefreshCw, color: Colors.info, bg: Colors.infoSoft },
  update: { icon: Sparkles, color: Colors.purple, bg: 'rgba(139, 92, 246, 0.16)' },
};

export default function NotificationsScreen() {
  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <ChevronLeft color={Colors.text} size={22} />
        </Pressable>
        <Text style={styles.title}>Уведомления</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={{ gap: Spacing.two, marginBottom: Spacing.four }}>
        {MOCK_NOTIFICATIONS.map((n) => {
          const meta = KIND_META[n.kind];
          const Icon = meta.icon;
          return (
            <Card key={n.id} style={[styles.row, !n.read && styles.rowUnread]}>
              <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                <Icon color={meta.color} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                <Text style={styles.notifMessage}>{n.message}</Text>
                <Text style={styles.notifTime}>{n.createdAt}</Text>
              </View>
              {!n.read && <View style={styles.unreadDot} />}
            </Card>
          );
        })}
      </View>
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
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  rowUnread: {
    borderColor: Colors.primary,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  notifMessage: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  notifTime: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 4,
  },
});
