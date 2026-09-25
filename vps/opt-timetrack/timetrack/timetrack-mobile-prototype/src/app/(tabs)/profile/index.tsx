import { router } from 'expo-router';
import {
  Bell, Briefcase, ChevronRight, Info, LogOut, Settings as SettingsIcon, User,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Colors, Spacing } from '@/constants/theme';
import { MOCK_EMPLOYEE, MOCK_LOCATION, MOCK_SCHEDULE } from '@/constants/mock-data';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

export default function ProfileScreen() {
  const logout = useAuthStore((s) => s.logout);
  const showToast = useToastStore((s) => s.show);

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>Профиль</Text>

      <View style={styles.heroRow}>
        <Avatar initials={MOCK_EMPLOYEE.avatarInitials} size={64} />
        <View>
          <Text style={styles.name}>{MOCK_EMPLOYEE.fullName}</Text>
          <Text style={styles.position}>{MOCK_EMPLOYEE.position}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Рабочая информация</Text>
      <Card style={{ marginBottom: Spacing.four, gap: Spacing.two }}>
        <InfoRow label="Компания" value={MOCK_EMPLOYEE.company} />
        <InfoRow label="Отдел" value={MOCK_EMPLOYEE.department} />
        <InfoRow label="Должность" value={MOCK_EMPLOYEE.position} />
        <InfoRow label="График" value={`${MOCK_SCHEDULE.name} · ${MOCK_SCHEDULE.startTime}–${MOCK_SCHEDULE.endTime}`} />
        <InfoRow label="Основной офис" value={MOCK_LOCATION.name} last />
      </Card>

      <View style={{ gap: Spacing.two, marginBottom: Spacing.four }}>
        <MenuRow icon={User} label="Личные данные" onPress={() => showToast('Раздел в разработке', 'info')} />
        <MenuRow icon={SettingsIcon} label="Настройки" onPress={() => router.push('/(tabs)/profile/settings')} />
        <MenuRow icon={Bell} label="Уведомления" onPress={() => router.push('/(tabs)/profile/notifications')} />
        <MenuRow icon={Info} label="О приложении" onPress={() => showToast('Timetrack.kz · Версия 1.0.0', 'info')} />
      </View>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <LogOut color={Colors.error} size={18} />
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </Pressable>
    </Screen>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MenuRow({ icon: Icon, label, onPress }: { icon: typeof Briefcase; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.menuRow}>
        <View style={styles.menuIcon}>
          <Icon color={Colors.primary} size={18} />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
        <ChevronRight color={Colors.textMuted} size={18} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.five,
  },
  name: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  position: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  infoValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.five,
  },
  logoutText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
});
