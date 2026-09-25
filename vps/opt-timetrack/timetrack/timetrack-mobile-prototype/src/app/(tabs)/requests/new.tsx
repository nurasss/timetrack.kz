import { useState } from 'react';
import { router } from 'expo-router';
import { Briefcase, Calendar, Coffee, Stethoscope, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRequestsStore } from '@/store/useRequestsStore';
import { useToastStore } from '@/store/useToastStore';
import type { LeaveType } from '@/types';

const TYPES: { key: LeaveType; label: string; icon: typeof Calendar }[] = [
  { key: 'VACATION', label: 'Отпуск', icon: Calendar },
  { key: 'SICK', label: 'Больничный', icon: Stethoscope },
  { key: 'BUSINESS_TRIP', label: 'Командировка', icon: Briefcase },
  { key: 'DAY_OFF', label: 'Отгул', icon: Coffee },
];

export default function NewRequestScreen() {
  const addRequest = useRequestsStore((s) => s.addRequest);
  const showToast = useToastStore((s) => s.show);

  const [type, setType] = useState<LeaveType>('VACATION');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!startDate || !endDate) {
      showToast('Укажите даты начала и окончания', 'error');
      return;
    }
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    addRequest({ type, startDate, endDate, comment: comment || undefined });
    setSubmitting(false);
    showToast('Заявка отправлена', 'success');
    router.back();
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Новая заявка</Text>
        <Pressable onPress={() => router.back()}>
          <X color={Colors.text} size={20} />
        </Pressable>
      </View>

      <Text style={styles.label}>Тип заявки</Text>
      <View style={styles.typeGrid}>
        {TYPES.map((item) => {
          const Icon = item.icon;
          const active = type === item.key;
          return (
            <Pressable
              key={item.key}
              style={[styles.typeChip, active && styles.typeChipActive]}
              onPress={() => setType(item.key)}
            >
              <Icon color={active ? '#06111D' : Colors.textSecondary} size={16} />
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Дата начала</Text>
      <TextInput
        style={styles.input}
        placeholder="2026-06-24"
        placeholderTextColor={Colors.textMuted}
        value={startDate}
        onChangeText={setStartDate}
      />

      <Text style={styles.label}>Дата окончания</Text>
      <TextInput
        style={styles.input}
        placeholder="2026-06-30"
        placeholderTextColor={Colors.textMuted}
        value={endDate}
        onChangeText={setEndDate}
      />

      <Text style={styles.label}>Комментарий</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Необязательно"
        placeholderTextColor={Colors.textMuted}
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={4}
      />

      <Button
        label="Отправить заявку"
        size="lg"
        loading={submitting}
        onPress={handleSubmit}
        style={{ marginTop: Spacing.four, marginBottom: Spacing.five }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  title: {
    color: Colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#06111D',
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    marginBottom: Spacing.three,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
});
