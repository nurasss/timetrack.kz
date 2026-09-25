import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';
import { colours, spacing } from '../../../packages/shared/theme';
import { t } from '../../../packages/shared/i18n';
import { useAppStore } from '../store/useAppStore';

export default function LoginScreen() {
  const router = useRouter();
  const { language, setLanguage, login } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Введите email и пароль');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Ошибка входа', error.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.container}>
        <View style={styles.logoMark}>
          <Ionicons name="timer" size={44} color={colours.primary} />
        </View>
        <Text style={styles.logo}>{t(language, 'appName')}</Text>
        <Text style={styles.subtitle}>{t(language, 'product')}</Text>

        <View style={styles.langSwitch}>
          <Pressable onPress={() => setLanguage('ru')} style={[styles.langButton, language === 'ru' && styles.langActive]}>
            <Text style={[styles.langText, language === 'ru' && styles.langTextActive]}>Рус</Text>
          </Pressable>
          <Pressable onPress={() => setLanguage('kz')} style={[styles.langButton, language === 'kz' && styles.langActive]}>
            <Text style={[styles.langText, language === 'kz' && styles.langTextActive]}>Қаз</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <TextInput
            placeholder={t(language, 'emailOrPhone')}
            placeholderTextColor={colours.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            placeholder={t(language, 'password')}
            placeholderTextColor={colours.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <Text style={styles.forgot}>{t(language, 'forgot')}</Text>

          <Button
            title={loading ? 'Вход...' : t(language, 'login')}
            onPress={handleLogin}
            disabled={loading}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>или</Text>
            <View style={styles.divider} />
          </View>

          <Button
            title={t(language, 'qrLogin')}
            variant="secondary"
            onPress={() => Alert.alert('Сканирование QR', 'Функция будет доступна в следующем обновлении')}
          />
        </View>
        <Text style={styles.version}>Версия 1.0.0 (Refined API)</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center', gap: 12, minHeight: 760 },
  logoMark: { width: 88, height: 88, borderRadius: 28, backgroundColor: 'rgba(41,193,102,0.12)', borderWidth: 1, borderColor: 'rgba(41,193,102,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logo: { color: colours.textPrimary, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: colours.textSecondary, fontSize: 16, marginBottom: spacing.md },
  langSwitch: { flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: colours.card, borderWidth: 1, borderColor: colours.border, marginBottom: spacing.md },
  langButton: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999 },
  langActive: { backgroundColor: colours.primary },
  langText: { color: colours.textSecondary, fontWeight: '700' },
  langTextActive: { color: colours.background },
  form: { width: '100%', gap: spacing.md },
  input: { width: '100%', backgroundColor: colours.card, borderColor: colours.border, borderWidth: 1, borderRadius: 16, padding: spacing.md, color: colours.textPrimary, fontSize: 16 },
  forgot: { color: colours.info, textAlign: 'right', fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  divider: { height: 1, backgroundColor: colours.border, flex: 1 },
  dividerText: { color: colours.textSecondary },
  version: { marginTop: spacing.xl, color: colours.textSecondary, fontSize: 12 }
});
