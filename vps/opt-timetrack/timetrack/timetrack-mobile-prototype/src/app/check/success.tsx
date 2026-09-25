import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Colors, Spacing } from '@/constants/theme';
import { MOCK_LOCATION } from '@/constants/mock-data';

export default function CheckSuccessScreen() {
  const { type, time } = useLocalSearchParams<{ type: string; time: string }>();
  const isCheckIn = type !== 'out';

  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <CheckCircle2 color={Colors.primary} size={88} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>{isCheckIn ? 'Приход отмечен' : 'Уход отмечен'}</Text>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.location}>{MOCK_LOCATION.name}</Text>
        <Text style={styles.accuracy}>Точность GPS: 12 м</Text>
      </View>

      <Button label="На главную" size="lg" onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginBottom: Spacing.four,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: Spacing.two,
  },
  time: {
    color: Colors.primary,
    fontSize: 36,
    fontWeight: '800',
    marginBottom: Spacing.three,
  },
  location: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  accuracy: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
});
