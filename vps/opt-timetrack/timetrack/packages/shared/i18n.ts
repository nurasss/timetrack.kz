import type { Language } from './types';

export const dictionary: Record<Language, Record<string, string>> = {
  ru: {
    appName: 'Timetrack.kz',
    product: 'Учет рабочего времени',
    login: 'Войти',
    emailOrPhone: 'Email или телефон',
    password: 'Пароль',
    forgot: 'Забыли пароль?',
    qrLogin: 'Войти через QR',
    home: 'Главная',
    history: 'История',
    requests: 'Заявки',
    calendar: 'Календарь',
    profile: 'Профиль',
    checkIn: 'Отметить приход',
    checkOut: 'Отметить уход'
  },
  kz: {
    appName: 'Timetrack.kz',
    product: 'Жұмыс уақытын есепке алу',
    login: 'Кіру',
    emailOrPhone: 'Email немесе телефон',
    password: 'Құпия сөз',
    forgot: 'Құпия сөзді ұмыттыңыз ба?',
    qrLogin: 'QR арқылы кіру',
    home: 'Басты',
    history: 'Тарих',
    requests: 'Өтініштер',
    calendar: 'Күнтізбе',
    profile: 'Профиль',
    checkIn: 'Келуді белгілеу',
    checkOut: 'Кетуді белгілеу'
  }
};

export function t(language: Language, key: string): string {
  return dictionary[language][key] ?? key;
}
