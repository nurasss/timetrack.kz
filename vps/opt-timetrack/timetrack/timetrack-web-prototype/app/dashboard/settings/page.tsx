'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2, Shield, Globe, Camera, Key, Plug, Save,
  ChevronRight, ArrowRight, Check, AlertCircle, Copy, Eye, EyeOff,
  Blocks, Zap, Lock, Users, ToggleLeft
} from 'lucide-react';
import { toast } from 'sonner';

type SettingsTab = 'company' | 'roles' | 'language' | 'photo' | 'api' | 'integrations';

const TABS: { key: SettingsTab; label: string; icon: any }[] = [
  { key: 'company', label: 'Компания', icon: Building2 },
  { key: 'roles', label: 'Роли и доступы', icon: Shield },
  { key: 'language', label: 'Язык интерфейса', icon: Globe },
  { key: 'photo', label: 'Политика фото', icon: Camera },
  { key: 'api', label: 'API ключи', icon: Key },
  { key: 'integrations', label: 'Интеграции', icon: Plug },
];

const ROLES = [
  {
    key: 'SUPER_ADMIN',
    label: 'Супер-администратор',
    desc: 'Полный доступ ко всему. Может управлять компаниями и тарифами.',
    badge: 'bg-red-100 text-red-700',
    permissions: ['Все модули', 'Управление компаниями', 'Биллинг', 'API'],
  },
  {
    key: 'COMPANY_ADMIN',
    label: 'Администратор',
    desc: 'Полный доступ в рамках своей компании.',
    badge: 'bg-brand-100 text-brand-700',
    permissions: ['Сотрудники', 'Локации', 'Графики', 'Отчёты', 'Настройки', 'API ключи'],
  },
  {
    key: 'HR',
    label: 'HR-менеджер',
    desc: 'Управление сотрудниками, заявки на отпуск.',
    badge: 'bg-purple-100 text-purple-700',
    permissions: ['Сотрудники (R/W)', 'Табель (R)', 'Отчёты (R)', 'Заявки (R/W)'],
  },
  {
    key: 'MANAGER',
    label: 'Руководитель',
    desc: 'Просмотр своего отдела и согласование заявок.',
    badge: 'bg-cyan-100 text-cyan-700',
    permissions: ['Сотрудники своего отдела (R)', 'Табель (R)', 'Заявки своего отдела (R/W)'],
  },
  {
    key: 'EMPLOYEE',
    label: 'Сотрудник',
    desc: 'Только мобильное приложение — приход/уход.',
    badge: 'bg-slate-100 text-slate-600',
    permissions: ['Check-in / Check-out', 'Своя история', 'Заявки (создать)'],
  },
];

function CompanySettings() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: 'ТОО «Алтын Логистик»',
    bin: '190540012345',
    industry: 'Логистика и транспорт',
    city: 'Алматы',
    timezone: 'Asia/Almaty',
    employeeCount: '25',
  });

  function handleSave() {
    setSaved(true);
    toast.success('Настройки компании сохранены');
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Информация о компании</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="form-label">Название компании</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">БИН</label>
            <input
              value={form.bin}
              onChange={e => setForm(f => ({ ...f, bin: e.target.value }))}
              className="form-input"
              placeholder="190540012345"
            />
          </div>
          <div>
            <label className="form-label">Отрасль</label>
            <input
              value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Город</label>
            <input
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Часовой пояс</label>
            <select
              value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              className="form-input appearance-none"
            >
              <option value="Asia/Almaty">Asia/Almaty (UTC+5)</option>
              <option value="Asia/Aqtau">Asia/Aqtau (UTC+5)</option>
              <option value="Asia/Qyzylorda">Asia/Qyzylorda (UTC+5)</option>
              <option value="Asia/Oral">Asia/Oral (UTC+5)</option>
            </select>
          </div>
        </div>
      </div>
      <button
        onClick={handleSave}
        className="btn-primary flex items-center gap-2"
      >
        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Сохранено!' : 'Сохранить'}
      </button>
    </div>
  );
}

function RolesSettings() {
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Настройка ролей</p>
          <p className="text-sm text-amber-700 mt-0.5">
            В первой версии роли фиксированы. Гибкая настройка прав доступа будет доступна в следующем релизе.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {ROLES.map(role => (
          <div key={role.key} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${role.badge}`}>
                    {role.key}
                  </span>
                  <h4 className="font-semibold text-slate-900">{role.label}</h4>
                </div>
                <p className="text-sm text-slate-500">{role.desc}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {role.permissions.map(p => (
                    <span key={p} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <Lock className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LanguageSettings() {
  const [lang, setLang] = useState('ru');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Язык интерфейса</h3>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          {[
            { key: 'ru', label: 'Русский', flag: '🇷🇺', ready: true },
            { key: 'kz', label: 'Қазақша', flag: '🇰🇿', ready: false },
          ].map(l => (
            <button
              key={l.key}
              onClick={() => {
                if (!l.ready) {
                  toast.info('Казахский язык — в разработке');
                  return;
                }
                setLang(l.key);
                toast.success('Язык изменён');
              }}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                lang === l.key
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-2xl">{l.flag}</span>
              <div className="text-left">
                <p className="font-medium text-slate-900">{l.label}</p>
                {!l.ready && <p className="text-xs text-slate-400">Скоро</p>}
                {l.ready && lang === l.key && <p className="text-xs text-brand-600">Активен</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="bg-brand-50 rounded-xl p-4">
        <p className="text-sm text-brand-800">
          Мобильное приложение поддерживает выбор языка на уровне сотрудника — RU или KZ независимо от настроек панели.
        </p>
      </div>
    </div>
  );
}

function PhotoSettings() {
  const [settings, setSettings] = useState({
    requirePhoto: true,
    retentionDays: 90,
    faceVerification: false,
    allowWithoutPhoto: false,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {[
          {
            key: 'requirePhoto' as const,
            label: 'Обязательное фото при отметке',
            desc: 'Сотрудник должен сделать селфи при каждом check-in и check-out',
          },
          {
            key: 'faceVerification' as const,
            label: 'Распознавание лица (Face ID)',
            desc: 'Проверка соответствия фото шаблону сотрудника (требует биометрический модуль)',
          },
          {
            key: 'allowWithoutPhoto' as const,
            label: 'Разрешить отметку без фото',
            desc: 'Только при отсутствии интернета (offline sync)',
          },
        ].map(item => (
          <div key={item.key} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">{item.label}</p>
              <p className="text-sm text-slate-500 mt-0.5">{item.desc}</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, [item.key]: !s[item.key] }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings[item.key] ? 'bg-brand-600' : 'bg-slate-300'
              }`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                settings[item.key] ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>
        ))}
      </div>
      <div>
        <label className="form-label">Срок хранения фото (дней)</label>
        <div className="flex items-center gap-3 max-w-xs">
          <input
            type="range"
            min={30}
            max={365}
            value={settings.retentionDays}
            onChange={e => setSettings(s => ({ ...s, retentionDays: Number(e.target.value) }))}
            className="flex-1 accent-brand-600"
          />
          <span className="text-sm font-semibold text-slate-700 w-16 text-right">
            {settings.retentionDays} дн
          </span>
        </div>
      </div>
      <button onClick={() => toast.success('Политика фото сохранена')} className="btn-primary flex items-center gap-2">
        <Save className="w-4 h-4" />
        Сохранить
      </button>
    </div>
  );
}

function ApiSettings() {
  const [show, setShow] = useState(false);
  const MOCK_KEY = 'tt_live_sk_c8a2d1f4e9b3a7c6d2e1f8a4b9c3d7e2';

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-700">Ваш API ключ</label>
          <button
            onClick={() => setShow(s => !s)}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {show ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-slate-900 text-emerald-400 rounded-lg px-3 py-2 text-sm font-mono overflow-hidden">
            {show ? MOCK_KEY : MOCK_KEY.replace(/./g, '•').slice(0, 20) + '...'}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(MOCK_KEY);
              toast.success('Ключ скопирован');
            }}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <Copy className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">Доступные endpoints</h4>
        {[
          { method: 'POST', path: '/api/auth/login', desc: 'Авторизация' },
          { method: 'GET', path: '/api/employees', desc: 'Список сотрудников' },
          { method: 'GET', path: '/api/attendance', desc: 'Журнал отметок' },
          { method: 'POST', path: '/api/attendance/check-in', desc: 'Фиксация прихода' },
          { method: 'GET', path: '/api/reports/timesheet', desc: 'Табель' },
        ].map(ep => (
          <div key={ep.path} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
            <span className={`text-xs font-bold w-12 ${ep.method === 'GET' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {ep.method}
            </span>
            <code className="text-xs text-slate-700 font-mono flex-1">{ep.path}</code>
            <span className="text-xs text-slate-400">{ep.desc}</span>
          </div>
        ))}
      </div>

      <div className="bg-brand-50 rounded-xl p-4">
        <p className="text-sm text-brand-800 font-medium mb-1">OpenAPI спецификация</p>
        <p className="text-sm text-brand-700">
          Полная документация API в формате OpenAPI 3.0 доступна в файле{' '}
          <code className="bg-brand-100 px-1 rounded text-xs">docs/openapi.yaml</code>
        </p>
      </div>
    </div>
  );
}

function IntegrationsSettings() {
  return (
    <Link
      href="/dashboard/integrations"
      className="card flex items-center justify-between gap-4 p-5 hover:border-brand-300 hover:shadow-card-hover transition-all group"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Plug className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">Управление интеграциями</p>
          <p className="text-sm text-slate-500 mt-0.5">
            1С, Bitrix24, Hikvision, ZKTeco, Telegram Bot, Webhooks и платёжные сервисы — на отдельной странице
          </p>
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
    </Link>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('company');

  const content: Record<SettingsTab, React.ReactNode> = {
    company: <CompanySettings />,
    roles: <RolesSettings />,
    language: <LanguageSettings />,
    photo: <PhotoSettings />,
    api: <ApiSettings />,
    integrations: <IntegrationsSettings />,
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Настройки</h1>
        <p className="text-slate-500 mt-1">Управление компанией, доступами и интеграциями</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  tab === t.key
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <t.icon className="w-4 h-4 flex-shrink-0" />
                {t.label}
                {tab !== t.key && <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="card p-6">
            {content[tab]}
          </div>
        </div>
      </div>
    </div>
  );
}
