/**
 * Timetrack.kz — дизайн-токены мобильного приложения.
 * Бренд тёмный (навy + зелёный) и не зависит от системной темы устройства —
 * см. timetrack_claude_code_ui_prompt.md, раздел 1.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  // Поверхности
  background: '#071421',
  backgroundAlt: '#0B1623',
  card: '#111E2D',
  cardAlt: '#152436',
  border: '#243448',

  // Текст
  text: '#F4F7FA',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Бренд
  primary: '#2ECC71',
  primaryDark: '#29C166',
  primarySoft: 'rgba(46, 204, 113, 0.16)',

  // Статусы
  success: '#2ECC71',
  error: '#EF4444',
  errorSoft: 'rgba(239, 68, 68, 0.16)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.16)',
  info: '#3B82F6',
  infoSoft: 'rgba(59, 130, 246, 0.16)',
  purple: '#8B5CF6',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorToken = keyof typeof Colors;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 28,
  full: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
