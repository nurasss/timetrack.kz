import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/ui/Screen';
import { colours, spacing } from '../../../packages/shared/theme';
import { useAppStore } from '../store/useAppStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, setLanguage } = useAppStore();
  const [dark, setDark] = useState(true);
  const [notify, setNotify] = useState(true);
  const [sound, setSound] = useState(true);
  const [offline, setOffline] = useState(true);
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}><Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="chevron-back" size={24} color={colours.textPrimary} /></Pressable><Text style={styles.title}>Настройки</Text><View style={{ width: 42 }} /></View>
        <SettingSwitch label="Темная тема" value={dark} onValueChange={setDark} />
        <SettingSwitch label="Уведомления" value={notify} onValueChange={setNotify} />
        <SettingSwitch label="Звук отметок" value={sound} onValueChange={setSound} />
        <SettingRow label="Язык" value={language === 'ru' ? 'Русский' : 'Қазақша'} onPress={() => setLanguage(language === 'ru' ? 'kz' : 'ru')} />
        <SettingRow label="Точность геолокации" value="Высокая" />
        <SettingSwitch label="Офлайн-режим" value={offline} onValueChange={setOffline} />
        <SettingRow label="Очистить кеш" value="128 МБ" danger />
        <SettingRow label="Версия приложения" value="1.0.0" />
      </ScrollView>
    </Screen>
  );
}

function SettingSwitch({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Switch value={value} onValueChange={onValueChange} thumbColor={colours.primary} trackColor={{ true: '#244E3A', false: colours.border }} /></View>;
}
function SettingRow({ label, value, danger, onPress }: { label: string; value: string; danger?: boolean; onPress?: () => void }) {
  return <Pressable onPress={onPress} style={styles.row}><Text style={[styles.rowLabel, danger && { color: colours.danger }]}>{label}</Text><Text style={styles.rowValue}>{value}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 70 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  back: { width: 42, height: 42, borderRadius: 15, backgroundColor: colours.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colours.border },
  title: { color: colours.textPrimary, fontSize: 24, fontWeight: '900' },
  row: { minHeight: 58, paddingHorizontal: spacing.md, borderRadius: 18, backgroundColor: colours.card, borderWidth: 1, borderColor: colours.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: colours.textPrimary, fontWeight: '800' },
  rowValue: { color: colours.textSecondary, fontWeight: '700' }
});
