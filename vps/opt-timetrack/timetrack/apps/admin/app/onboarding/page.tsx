import { CheckCircle2, Circle, MapPin, TabletSmartphone, Users } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { onboardingSteps, workspace } from '../../lib/panel-data';

export default function OnboardingPage() {
  const completed = onboardingSteps.filter((step) => step.done).length;
  const progress = Math.round((completed / onboardingSteps.length) * 100);

  return (
    <div>
      <PageHeader title="Onboarding" subtitle="Пошаговая настройка компании, графиков, локаций, Android-отметок и kiosk-устройств.">
        <a href="/dashboard" className="control">Вернуться в обзор</a>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <StatusBadge tone="info">Настройка</StatusBadge>
              <h2 className="mt-3 text-2xl font-black text-slate-900">{workspace.company}</h2>
              <p className="mt-2 text-sm text-slate-500">Готовность панели: {progress}%. Добавьте данные компании, филиалы, графики и сотрудников.</p>
            </div>
            <div className="grid h-24 w-24 place-items-center rounded-full border-[10px] border-emerald-100 text-2xl font-black text-primary">
              {progress}%
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {onboardingSteps.map((step, index) => (
              <div key={step.title} className="flex items-center justify-between rounded-lg border border-line bg-white p-4">
                <div className="flex items-center gap-3">
                  {step.done ? <CheckCircle2 className="text-primary" size={22} /> : <Circle className="text-slate-300" size={22} />}
                  <div>
                    <p className="font-black text-slate-900">{index + 1}. {step.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{step.done ? 'Готово и уже используется' : 'Ожидает настройки'}</p>
                  </div>
                </div>
                <StatusBadge tone={step.done ? 'success' : 'neutral'}>{step.done ? 'Готово' : 'Далее'}</StatusBadge>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="card p-5">
            <MapPin className="text-primary" size={24} />
            <h2 className="mt-4 text-lg font-black text-slate-900">Что уже работает</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>После настройки здесь появятся филиалы, геозоны, графики и правила отметок.</p>
              <p>Android-приложение начнет принимать отметки после добавления сотрудников и локаций.</p>
            </div>
          </div>
          <div className="card p-5">
            <Users className="text-blue-600" size={24} />
            <h2 className="mt-4 text-lg font-black text-slate-900">Следующее действие</h2>
            <p className="mt-2 text-sm text-slate-500">Пригласите HR, бухгалтера и руководителей отделов с ограничением по филиалам.</p>
            <button className="primary-control mt-4 w-full">Пригласить команду</button>
          </div>
          <div className="card p-5">
            <TabletSmartphone className="text-amber-600" size={24} />
            <h2 className="mt-4 text-lg font-black text-slate-900">Kiosk-планшет</h2>
            <p className="mt-2 text-sm text-slate-500">Создайте устройство, отсканируйте QR и закрепите его за входом в офис.</p>
            <a href="/devices" className="control mt-4 w-full">Открыть устройства</a>
          </div>
        </aside>
      </div>
    </div>
  );
}
