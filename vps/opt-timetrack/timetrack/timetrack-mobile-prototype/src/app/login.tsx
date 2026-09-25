import { useState } from 'react';
import { router } from 'expo-router';
import { Clock, Eye, EyeOff, Lock, Mail, QrCode } from 'lucide-react-native';
import {
  Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { LOCALE_LABELS, t } from '@/constants/i18n';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

export default function LoginScreen() {
  const { locale, setLocale, login } = useAuthStore();
  const showToast = useToastStore((s) => s.show);

  const [emailOrPhone, setEmailOrPhone] = useState('alexey@timetrack.kz');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!emailOrPhone || !password) {
      showToast('Введите email/телефон и пароль', 'error');
      return;
    }
    setLoading(true);
    try {
      await login(emailOrPhone, password);
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Screen scroll>
        <View style={styles.langRow}>
          {(['ru', 'kz'] as const).map((l) => (
            <Pressable key={l} onPress={() => setLocale(l)} style={styles.langItem}>
              <Text style={[styles.langText, locale === l && styles.langTextActive]}>
                {LOCALE_LABELS[l]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <Clock color="#06111D" size={32} strokeWidth={2.5} />
          </View>
          <Text style={styles.brand}>
            Timetrack<Text style={styles.brandAccent}>.kz</Text>
          </Text>
          <Text style={styles.tagline}>{t('appTagline', locale)}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldCard}>
            <Mail color={Colors.textMuted} size={18} />
            <TextInput
              style={styles.input}
              placeholder={t('login_emailOrPhone', locale)}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
            />
          </View>

          <View style={styles.fieldCard}>
            <Lock color={Colors.textMuted} size={18} />
            <TextInput
              style={styles.input}
              placeholder={t('login_password', locale)}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)}>
              {showPassword ? (
                <EyeOff color={Colors.textMuted} size={18} />
              ) : (
                <Eye color={Colors.textMuted} size={18} />
              )}
            </Pressable>
          </View>

          <Pressable style={styles.forgotLink} onPress={() => showToast('Восстановление пароля скоро будет доступно', 'info')}>
            <Text style={styles.forgotText}>{t('login_forgot', locale)}</Text>
          </Pressable>

          <Button label={t('login_submit', locale)} size="lg" loading={loading} onPress={handleLogin} />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('login_or', locale)}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            label={t('login_qr', locale)}
            variant="secondary"
            size="lg"
            icon={<QrCode color={Colors.text} size={18} />}
            onPress={() => showToast('Вход через QR скоро будет доступен', 'info')}
          />
        </View>

        <Text style={styles.version}>{t('login_version', locale)}</Text>
        <Pressable onPress={() => router.push('/kiosk')} style={styles.kioskLink}>
          <Text style={styles.kioskLinkText}>Режим планшета (kiosk)</Text>
        </Pressable>
      </Screen>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  langRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  langItem: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  langText: {
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: 13,
  },
  langTextActive: {
    color: Colors.primary,
  },
  hero: {
    alignItems: 'center',
    marginTop: Spacing.six,
    marginBottom: Spacing.five,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: Colors.primary,
  },
  tagline: {
    color: Colors.textSecondary,
    marginTop: Spacing.one,
    fontSize: 14,
  },
  form: {
    gap: Spacing.three,
  },
  fieldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    height: 52,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -Spacing.two,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.one,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  version: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
  },
  kioskLink: {
    alignItems: 'center',
    paddingBottom: Spacing.four,
  },
  kioskLinkText: {
    color: Colors.textMuted,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
