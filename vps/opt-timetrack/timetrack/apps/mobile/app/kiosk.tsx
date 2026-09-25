import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/ui/Screen';
import { Avatar } from '../components/ui/Avatar';
import { colours, spacing } from '../../../packages/shared/theme';
import { employees, getPositionName } from '../../../packages/shared/mock-data';

type KioskState = 'idle' | 'face_detected' | 'liveness' | 'success' | 'failed';
const states: KioskState[] = ['idle', 'face_detected', 'liveness', 'success', 'failed'];

export default function KioskScreen() {
  const [state, setState] = useState<KioskState>('idle');
  const employee = employees[0];
  return (
    <Screen>
      <View style={styles.wrapper}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.logo}>Timetrack.kz</Text>
            <Text style={styles.sub}>Kiosk mode · проходная офиса</Text>
          </View>
          <Text style={styles.clock}>{new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.cameraPane}>
            <View style={styles.cameraHeader}><Text style={styles.cameraLabel}>Камера включена 24/7</Text><View style={styles.liveDot} /></View>
            <View style={[styles.faceBox, (state === 'face_detected' || state === 'liveness' || state === 'success') && styles.faceBoxActive, state === 'failed' && styles.faceBoxFailed]}>
              <View style={styles.faceHead} />
              <View style={styles.faceBody} />
              <View style={styles.scan} />
            </View>
            <Text style={styles.cameraHint}>{state === 'idle' ? 'Подойдите ближе к камере' : state === 'failed' ? 'Сотрудник не найден' : 'Лицо в кадре, идет проверка'}</Text>
          </View>

          <View style={styles.statusPane}>{renderStatus(state, employee)}</View>
        </View>

        <View style={styles.controls}>{states.map((item) => <Pressable key={item} onPress={() => setState(item)} style={[styles.control, state === item && styles.controlActive]}><Text style={styles.controlText}>{item}</Text></Pressable>)}</View>
      </View>
    </Screen>
  );
}

function renderStatus(state: KioskState, employee: typeof employees[number]) {
  if (state === 'idle') return <><Ionicons name="scan" size={72} color={colours.primary} /><Text style={styles.statusTitle}>Ожидание сотрудника</Text><Text style={styles.statusText}>Подойдите к камере. Система распознает лицо на расстоянии 60-90 см.</Text></>;
  if (state === 'face_detected') return <><Ionicons name="person-circle" size={86} color={colours.primary} /><Text style={styles.statusTitle}>Лицо найдено</Text><Text style={styles.statusText}>Сотрудник распознан. Запускаем liveness-проверку.</Text></>;
  if (state === 'liveness') return <><Text style={styles.command}>Моргните</Text><Text style={styles.statusText}>Следуйте командам системы, чтобы подтвердить живое присутствие.</Text><View style={styles.progress}><View style={styles.progressFill} /></View></>;
  if (state === 'success') return <><Avatar name={`${employee.firstName} ${employee.lastName}`} size={110} /><Text style={styles.successName}>{employee.firstName} {employee.lastName}</Text><Text style={styles.statusText}>{getPositionName(employee.positionId)}</Text><Text style={styles.success}>Приход отмечен · 08:56</Text><Text style={styles.welcome}>Добро пожаловать</Text></>;
  return <><Ionicons name="alert-circle" size={82} color={colours.danger} /><Text style={[styles.statusTitle, { color: colours.danger }]}>Сотрудник не найден</Text><Text style={styles.statusText}>Лицо не совпало с профилем сотрудника.</Text><View style={styles.actionRow}><Text style={styles.retry}>Попробовать снова</Text><Text style={styles.admin}>Позвать администратора</Text></View></>;
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, padding: spacing.lg, gap: spacing.md },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { color: colours.textPrimary, fontSize: 32, fontWeight: '900' },
  sub: { color: colours.textSecondary, fontSize: 15, marginTop: 4 },
  clock: { color: colours.primary, fontSize: 42, fontWeight: '900' },
  content: { flex: 1, flexDirection: 'row', gap: spacing.lg },
  cameraPane: { flex: 1.25, backgroundColor: '#050E19', borderWidth: 1, borderColor: colours.border, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cameraHeader: { position: 'absolute', top: spacing.lg, left: spacing.lg, right: spacing.lg, flexDirection: 'row', justifyContent: 'space-between' },
  cameraLabel: { color: colours.textSecondary, fontSize: 18, fontWeight: '800' },
  liveDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: colours.primary },
  faceBox: { width: 280, height: 350, borderRadius: 150, borderWidth: 3, borderColor: colours.border, alignItems: 'center', justifyContent: 'center' },
  faceBoxActive: { borderColor: colours.primary },
  faceBoxFailed: { borderColor: colours.danger },
  faceHead: { width: 118, height: 118, borderRadius: 59, backgroundColor: '#25364E' },
  faceBody: { width: 184, height: 86, borderRadius: 50, backgroundColor: '#1A2B40', marginTop: 20 },
  scan: { position: 'absolute', left: 45, right: 45, top: 118, height: 3, backgroundColor: colours.primary },
  cameraHint: { position: 'absolute', bottom: spacing.lg, color: colours.textSecondary, fontSize: 18 },
  statusPane: { flex: 0.85, backgroundColor: colours.card, borderWidth: 1, borderColor: colours.border, borderRadius: 32, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  statusTitle: { color: colours.textPrimary, fontSize: 34, fontWeight: '900', textAlign: 'center' },
  statusText: { color: colours.textSecondary, fontSize: 19, lineHeight: 28, textAlign: 'center' },
  command: { color: colours.primary, fontSize: 58, fontWeight: '900', textAlign: 'center' },
  progress: { height: 12, backgroundColor: '#0B1623', borderRadius: 99, width: '80%', overflow: 'hidden', marginTop: spacing.md },
  progressFill: { width: '66%', height: '100%', backgroundColor: colours.primary },
  successName: { color: colours.textPrimary, fontSize: 36, fontWeight: '900', textAlign: 'center' },
  success: { color: colours.primary, fontSize: 24, fontWeight: '900' },
  welcome: { color: colours.textPrimary, fontSize: 28, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  retry: { color: colours.background, backgroundColor: colours.primary, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16, overflow: 'hidden', fontWeight: '900' },
  admin: { color: colours.textPrimary, backgroundColor: '#0B1623', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16, overflow: 'hidden', fontWeight: '900' },
  controls: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  control: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colours.border, backgroundColor: colours.card },
  controlActive: { borderColor: colours.primary },
  controlText: { color: colours.textSecondary, fontWeight: '800' }
});
