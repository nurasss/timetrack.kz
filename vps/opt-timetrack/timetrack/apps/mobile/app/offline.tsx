import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';
import { colours, spacing } from '../../../packages/shared/theme';
import { useAppStore } from '../store/useAppStore';

export default function OfflineScreen() {
  const { pendingSyncCount, syncing, syncOffline } = useAppStore();
  const [synced, setSynced] = useState(false);
  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.illustration}><Ionicons name="cloud-offline" size={74} color={colours.primary} /></View>
        <Text style={styles.title}>{synced ? 'Синхронизация завершена' : 'Вы работаете офлайн'}</Text>
        <Text style={styles.description}>Отметки сохраняются на устройстве и подтверждаются сервером при восстановлении соединения.</Text>
        <View style={styles.counter}><Text style={styles.counterValue}>{pendingSyncCount}</Text><Text style={styles.counterText}>отметки ожидают подтверждения сервера</Text></View>
        <Button
          title={syncing ? 'Синхронизация...' : pendingSyncCount === 0 ? 'Все подтверждено' : 'Синхронизировать сейчас'}
          disabled={pendingSyncCount === 0 || syncing}
          onPress={async () => {
            await syncOffline();
            setSynced(true);
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  illustration: { width: 150, height: 150, borderRadius: 42, backgroundColor: colours.card, borderWidth: 1, borderColor: colours.border, alignItems: 'center', justifyContent: 'center' },
  title: { color: colours.textPrimary, fontSize: 27, fontWeight: '900', textAlign: 'center' },
  description: { color: colours.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.sm },
  counter: { width: '100%', backgroundColor: colours.card, borderRadius: 24, borderWidth: 1, borderColor: colours.border, padding: spacing.lg, alignItems: 'center', marginVertical: spacing.md },
  counterValue: { color: colours.primary, fontSize: 48, fontWeight: '900' },
  counterText: { color: colours.textSecondary, marginTop: 5 }
});
