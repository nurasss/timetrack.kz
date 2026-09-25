import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';
import { colours, spacing } from '../../../packages/shared/theme';
import { useAppStore } from '../store/useAppStore';

export default function SuccessScreen() {
  const router = useRouter();
  const { attendance, lastCreatedMark, locations } = useAppStore();
  const last = lastCreatedMark ?? attendance[0];

  if (!last) {
    return (
      <Screen>
        <View style={styles.container}>
          <Text style={styles.title}>Отметок пока нет</Text>
          <Button title="Home" onPress={() => router.replace('/(tabs)/home')} />
        </View>
      </Screen>
    );
  }

  const locationName = locations.find((location) => location.id === last.location_id)?.name ?? 'Локация проверена сервером';

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={72} color={colours.background} />
        </View>
        <Text style={styles.title}>{last.type === 'CHECK_IN' ? 'Check-in saved' : 'Check-out saved'}</Text>
        <Text style={styles.time}>{new Date(last.marked_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</Text>
        <View style={styles.details}>
          <Text style={styles.detail}>Location: {locationName}</Text>
          <Text style={styles.detail}>GPS accuracy: {last.accuracy_meters ?? 0} m</Text>
          <Text style={styles.detail}>Server status: {last.status}</Text>
        </View>
        <Button title="Home" onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  checkCircle: { width: 130, height: 130, borderRadius: 65, backgroundColor: colours.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colours.primary, shadowOpacity: 0.4, shadowRadius: 30 },
  title: { color: colours.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  time: { color: colours.primary, fontSize: 48, fontWeight: '900' },
  details: { width: '100%', backgroundColor: colours.card, borderWidth: 1, borderColor: colours.border, borderRadius: 24, padding: spacing.lg, marginVertical: spacing.md, gap: 8 },
  detail: { color: colours.textSecondary, fontSize: 15 }
});
