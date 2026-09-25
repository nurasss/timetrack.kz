import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Briefcase, Calendar, Coffee, Stethoscope } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Colors, Spacing } from '@/constants/theme';
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types';

const TYPE_LABEL: Record<LeaveType, string> = {
  VACATION: 'Отпуск',
  SICK: 'Больничный',
  BUSINESS_TRIP: 'Командировка',
  DAY_OFF: 'Отгул',
};

const TYPE_ICON: Record<LeaveType, typeof Calendar> = {
  VACATION: Calendar,
  SICK: Stethoscope,
  BUSINESS_TRIP: Briefcase,
  DAY_OFF: Coffee,
};

const STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: 'На рассмотрении',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
};

const STATUS_TONE: Record<LeaveStatus, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

function fmt(date: string) {
  return format(parseISO(date), 'd MMM', { locale: ru });
}

export function RequestCard({ request }: { request: LeaveRequest }) {
  const Icon = TYPE_ICON[request.type];

  return (
    <Card style={styles.card}>
      <View style={styles.iconWrap}>
        <Icon color={Colors.primary} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.type}>{TYPE_LABEL[request.type]}</Text>
        <Text style={styles.dates}>
          {fmt(request.startDate)} – {fmt(request.endDate)} · {request.daysCount} дн.
        </Text>
        {request.comment && <Text style={styles.comment}>{request.comment}</Text>}
      </View>
      <Badge label={STATUS_LABEL[request.status]} tone={STATUS_TONE[request.status]} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  type: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dates: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  comment: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
});
