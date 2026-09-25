/**
 * Минимальный словарь RU/KZ. По умолчанию — русский (KZ — задел на будущее,
 * см. timetrack_claude_code_ui_prompt.md, раздел 3: "русский интерфейс +
 * задел под казахский через словарь ru/kz").
 */

export type Locale = 'ru' | 'kz';

const dict = {
  ru: {
    appName: 'Timetrack.kz',
    appTagline: 'Учёт рабочего времени',
    login_emailOrPhone: 'Email или телефон',
    login_password: 'Пароль',
    login_forgot: 'Забыли пароль?',
    login_submit: 'Войти',
    login_or: 'или',
    login_qr: 'Войти через QR',
    login_version: 'Версия 1.0.0',
    home_title: 'Главная',
    home_today: 'Сегодня',
    home_schedule: 'График',
    home_lunch: 'Обед',
    home_arrived: 'Пришёл',
    home_left: 'Ушёл',
    home_checkIn: 'Отметить приход',
    home_checkOut: 'Отметить уход',
    home_lastMark: 'Последняя отметка',
    home_onWork: 'На работе',
    home_notMarked: 'Не отмечен',
    nav_home: 'Главная',
    nav_history: 'История',
    nav_requests: 'Заявки',
    nav_profile: 'Профиль',
  },
  kz: {
    appName: 'Timetrack.kz',
    appTagline: 'Жұмыс уақытын есепке алу',
    login_emailOrPhone: 'Email немесе телефон',
    login_password: 'Құпия сөз',
    login_forgot: 'Құпия сөзді ұмыттыңыз ба?',
    login_submit: 'Кіру',
    login_or: 'немесе',
    login_qr: 'QR арқылы кіру',
    login_version: 'Нұсқа 1.0.0',
    home_title: 'Басты бет',
    home_today: 'Бүгін',
    home_schedule: 'Кесте',
    home_lunch: 'Түскі ас',
    home_arrived: 'Келді',
    home_left: 'Кетті',
    home_checkIn: 'Келгенін белгілеу',
    home_checkOut: 'Кеткенін белгілеу',
    home_lastMark: 'Соңғы белгі',
    home_onWork: 'Жұмыста',
    home_notMarked: 'Белгіленбеген',
    nav_home: 'Басты бет',
    nav_history: 'Тарих',
    nav_requests: 'Өтінімдер',
    nav_profile: 'Профиль',
  },
} satisfies Record<Locale, Record<string, string>>;

export type DictKey = keyof typeof dict.ru;

export function t(key: DictKey, locale: Locale = 'ru'): string {
  return dict[locale][key] ?? dict.ru[key] ?? key;
}

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: 'Рус',
  kz: 'Қаз',
};
