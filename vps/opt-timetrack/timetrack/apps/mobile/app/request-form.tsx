import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';
import { colours, spacing } from '../../../packages/shared/theme';
import { useAppStore } from '../store/useAppStore';

const types: { key: string; label: string }[] = [
  { key: 'VACATION', label: 'Отпуск' },
  { key: 'SICK', label: 'Больничный' },
  { key: 'BUSINESS_TRIP', label: 'Командировка' },
  { key: 'DAY_OFF', label: 'Отгул' }
];

export default function RequestForm() {
  const router = useRouter();
  const createRequest = useAppStore((state) => state.createRequest);
  const [type, setType] = useState('VACATION');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Новая заявка</Text>
        <Text style={styles.label}>Тип заявки</Text>
        <View style={styles.typeRow}>{types.map((item) => <Pressable key={item.key} onPress={() => setType(item.key)} style={[styles.typeButton, type === item.key && styles.typeActive]}><Text style={[styles.typeText, type === item.key && styles.typeTextActive]}>{item.label}</Text></Pressable>)}</View>
        <Text style={styles.label}>Дата начала</Text>
        <TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colours.textSecondary} style={styles.input} />
        <Text style={styles.label}>Дата окончания</Text>
        <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colours.textSecondary} style={styles.input} />
        <Text style={styles.label}>Комментарий</Text>
        <TextInput value={comment} onChangeText={setComment} placeholder="Комментарий" placeholderTextColor={colours.textSecondary} style={[styles.input, styles.textarea]} multiline />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          title={submitting ? 'Отправляем...' : 'Отправить заявку'}
          disabled={submitting}
          onPress={async () => {
            setError(null);
            setSubmitting(true);
            try {
              await createRequest(type, startDate.trim(), endDate.trim(), comment.trim());
              router.replace('/(tabs)/requests');
            } catch (requestError) {
              setError(requestError instanceof Error ? requestError.message : 'Не удалось отправить заявку');
            } finally {
              setSubmitting(false);
            }
          }}
        />
        <Button title="Отмена" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: 70 },
  title: { color: colours.textPrimary, fontSize: 28, fontWeight: '900' },
  label: { color: colours.textSecondary, fontWeight: '700', marginTop: spacing.sm },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colours.card, borderWidth: 1, borderColor: colours.border },
  typeActive: { backgroundColor: colours.primary, borderColor: colours.primary },
  typeText: { color: colours.textSecondary, fontWeight: '800' },
  typeTextActive: { color: colours.background },
  input: { backgroundColor: colours.card, borderWidth: 1, borderColor: colours.border, borderRadius: 16, padding: spacing.md, color: colours.textPrimary, fontSize: 16 },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  error: { color: colours.danger, fontWeight: '700' }
});
