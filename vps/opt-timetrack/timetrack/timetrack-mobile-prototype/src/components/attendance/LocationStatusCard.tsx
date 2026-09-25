import { AlertTriangle, CheckCircle2, MapPin } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { MOCK_LOCATION } from '@/constants/mock-data';

interface LocationStatusCardProps {
  status: 'loading' | 'ok' | 'error';
  accuracyMeters?: number;
}

export function LocationStatusCard({ status, accuracyMeters = 12 }: LocationStatusCardProps) {
  return (
    <View>
      {/* Pseudo-map */}
      <View style={styles.map}>
        <View style={[styles.geofence, status === 'error' && styles.geofenceError]} />
        <View style={styles.pin}>
          <MapPin color="#06111D" size={16} />
        </View>
        <Text style={styles.mapLabel}>{MOCK_LOCATION.name}</Text>
        <Text style={styles.mapAddress}>{MOCK_LOCATION.address}</Text>
      </View>

      <Card style={styles.statusCard}>
        {status === 'loading' && (
          <>
            <View style={[styles.statusIcon, { backgroundColor: Colors.infoSoft }]}>
              <MapPin color={Colors.info} size={16} />
            </View>
            <Text style={styles.statusText}>Проверяем геолокацию…</Text>
          </>
        )}
        {status === 'ok' && (
          <>
            <View style={[styles.statusIcon, { backgroundColor: Colors.primarySoft }]}>
              <CheckCircle2 color={Colors.primary} size={16} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusText}>Вы находитесь в зоне офиса</Text>
              <Text style={styles.statusSubText}>Точность: {accuracyMeters} м</Text>
            </View>
          </>
        )}
        {status === 'error' && (
          <>
            <View style={[styles.statusIcon, { backgroundColor: Colors.errorSoft }]}>
              <AlertTriangle color={Colors.error} size={16} />
            </View>
            <Text style={[styles.statusText, { color: Colors.error }]}>Вы вне разрешённой зоны</Text>
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 160,
    borderRadius: Radius.lg,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
    overflow: 'hidden',
  },
  geofence: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  geofenceError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorSoft,
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  mapLabel: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  mapAddress: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  statusSubText: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
