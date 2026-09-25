import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui/Card';
import { Badge, BadgeVariant } from '../ui/Badge';
import { colours, spacing } from '../../../../packages/shared/theme';
import type { ApiLeaveRequest } from '../../../../packages/shared/services/realApi';

function typeName(type: string) {
  if (type === 'VACATION') return 'Отпуск';
  if (type === 'SICK') return 'Больничный';
  if (type === 'BUSINESS_TRIP') return 'Командировка';
  if (type === 'DAY_OFF') return 'Отгул';
  return type;
}

function statusName(status: string) {
  if (status === 'APPROVED') return 'Одобрена';
  if (status === 'REJECTED') return 'Отклонена';
  if (status === 'CANCELLED') return 'Отменена';
  return 'На рассмотрении';
}

export function RequestCard({ request }: { request: ApiLeaveRequest }) {
  const variant: BadgeVariant = request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'error' : 'warning';
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View>
          <Text style={styles.title}>{typeName(request.type)}</Text>
          <Text style={styles.date}>{request.start_date} — {request.end_date}</Text>
        </View>
        <Badge label={statusName(request.status)} variant={variant} />
      </View>
      {!!request.comment && <Text style={styles.comment}>{request.comment}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  title: { color: colours.textPrimary, fontSize: 16, fontWeight: '700' },
  date: { color: colours.textSecondary, marginTop: 4 },
  comment: { color: colours.textSecondary, marginTop: spacing.md, fontSize: 13, lineHeight: 18 }
});
