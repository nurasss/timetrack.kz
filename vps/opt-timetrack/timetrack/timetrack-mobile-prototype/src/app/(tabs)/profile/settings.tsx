import { useState } from 'react';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Colors, Spacing } from '@/constants/theme';
import { LOCALE_LABELS } from '@/constants/i18n';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

const ACCURACY_LEVELS = ['Высокая', 'Средняя', 'Низкая'] as const;

export default function SettingsScreen() {
  const { locale, setLocale } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [accuracyIdx, setAccuracyIdx] = useState(0);

  function cycleLocale() {
    setLocale(locale === 'ru' ? 'kz' : 'ru');
  }

  function cycleAccuracy() {
    setAccuracyIdx((i) => (i + 1) % ACCURACY_LEVELS.length);
  }

  function clearCache() {
    showToast('Кэш очищен · освобождено 12,4 МБ', 'success');
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <ChevronLeft color={Colors.text} size={22} />
        </Pressable>
        <Text style={styles.title}>Настройки</Text>
        <View style={{ width: 22 }} />
      </View>

      <Card style={{ gap: Spacing.three, marginBottom: Spacing.three }}>
        <ToggleRow
          label="Тёмная тема"
          desc="В этой версии доступна только тёмная тема"
          value
          onChange={() => showToast('В этой версии доступна только тёмная тема', 'info')}
        />
        <Divider />
        <ToggleRow label="Уведомления" value={notifications} onChange={setNotifications} />
        <Divider />
        <ToggleRow label="Звук отметок" value={sound} onChange={setSound} />
      </Card>

      <Card style={{ gap: Spacing.three, marginBottom: Spacing.three }}>
        <LinkRow label="Язык" value={LOCALE_LABELS[locale] === 'Рус' ? 'Русский' : 'Қазақша'} onPress={cycleLocale} />
        <Divider />
        <LinkRow label="Точность геолокации" value={ACCURACY_LEVELS[accuracyIdx]} onPress={cycleAccuracy} />
        <Divider />
        <LinkRow label="Офлайн-режим" value="" onPress={() => router.push('/offline')} />
      </Card>

      <Pressable onPress={clearCache}>
        <Card style={styles.dangerRow}>
          <Trash2 color={Colors.error} size={18} />
          <Text style={styles.dangerLabel}>Очистить кэш</Text>
        </Card>
      </Pressable>

      <Text style={styles.version}>Версия приложения 1.0.0</Text>
    </Screen>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: Colors.border }} />;
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {desc && <Text style={styles.rowDesc}>{desc}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.white}
      />
    </View>
  );
}

function LinkRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>
        {!!value && <Text style={styles.rowValue}>{value}</Text>}
        <ChevronRight color={Colors.textMuted} size={16} />
      </View>
    </Pressable>
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowDesc: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  rowValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  dangerLabel: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  version: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginVertical: Spacing.four,
  },
});
