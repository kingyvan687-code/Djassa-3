import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  Clock,
  Moon,
  BarChart2,
  Check,
  ChevronRight,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface ScreenTimeSettingsScreenProps {
  onBack: () => void;
}

function getLast7DaysChart(dailyUsageMinutes: Record<string, number>) {
  const days: Array<{ key: string; label: string; minutes: number; isToday: boolean }> = [];
  const formatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
  const now = new Date();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - offset);
    const key = d.toISOString().slice(0, 10);
    const rawLabel = formatter.format(d).replace('.', '');
    const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1, 3);
    days.push({
      key,
      label,
      minutes: dailyUsageMinutes[key] || 0,
      isToday: offset === 0,
    });
  }
  return days;
}

export const ScreenTimeSettingsScreen: React.FC<ScreenTimeSettingsScreenProps> = ({ onBack }) => {
  const { clientPreferences, updateClientPreferences, showToast } = useApp();
  const screenTime = clientPreferences.screenTime;

  const [sleepTime, setSleepTime] = useState(screenTime.sleepStartHour || '22:30');
  const [activeModal, setActiveModal] = useState<null | 'daily_limit' | 'sleep_reminder'>(null);

  const chartData = useMemo(
    () => getLast7DaysChart(screenTime.dailyUsageMinutes || {}),
    [screenTime.dailyUsageMinutes]
  );

  const todayMinutes = chartData[chartData.length - 1]?.minutes || 0;
  const totalWeekMinutes = chartData.reduce((acc, curr) => acc + curr.minutes, 0);
  const maxMinutes = Math.max(...chartData.map((d) => d.minutes), 60);

  const handleSelectDailyLimit = (val: number | null) => {
    void updateClientPreferences({
      screenTime: {
        ...screenTime,
        dailyLimitMinutes: val,
      },
    });
    setActiveModal(null);
    showToast(val ? `Limite fixée à ${val} min/jour` : 'Limite quotidienne désactivée');
  };

  const handleSaveSleepReminder = (enabled: boolean) => {
    void updateClientPreferences({
      screenTime: {
        ...screenTime,
        sleepReminderEnabled: enabled,
        sleepStartHour: sleepTime,
      },
    });
    setActiveModal(null);
    showToast(enabled ? `Rappel de sommeil configuré à ${sleepTime}` : 'Rappel de sommeil désactivé');
  };

  return (
    <div
      id="screen-time-settings-screen"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Retour"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-extrabold text-white tracking-tight">
            Temps d'écran
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16 p-4 space-y-6">
        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-white/5 rounded-3xl border border-white/5 space-y-1">
            <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Aujourd'hui</span>
            <p className="text-2xl font-black text-white">{todayMinutes} min</p>
            <p className="text-[10px] text-white/40">Temps mesuré dans la session</p>
          </div>

          <div className="p-4 bg-white/5 rounded-3xl border border-white/5 space-y-1">
            <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">7 derniers jours</span>
            <p className="text-2xl font-black text-white">{totalWeekMinutes} min</p>
            <p className="text-[10px] text-white/40">~{Math.round(totalWeekMinutes / 7)} min / jour</p>
          </div>
        </div>

        {/* WEEKLY USAGE BAR CHART */}
        <div className="p-5 bg-[#121212] border border-white/5 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-[#FF6321]" />
              Activité quotidienne sur Djassa
            </span>
            <span className="text-[10px] text-white/40">7 derniers jours</span>
          </div>

          <div className="h-28 flex items-end justify-between gap-2 pt-2 px-1">
            {chartData.map((item) => {
              const heightPercent = item.minutes > 0 ? Math.max(8, Math.round((item.minutes / maxMinutes) * 100)) : 0;
              return (
                <div key={item.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[9px] text-white/50 font-semibold">{item.minutes}m</span>
                  <div className="w-full max-w-[20px] bg-white/10 rounded-t-lg h-full flex items-end overflow-hidden">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        item.isToday ? 'bg-[#FF6321]' : 'bg-white/30'
                      }`}
                    />
                  </div>
                  <span className={`text-[10px] font-bold ${item.isToday ? 'text-[#FF6321]' : 'text-white/40'}`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 1: LIMITES */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block">
            CONTRÔLE DU TEMPS D'ÉCRAN
          </span>

          <div className="bg-[#121212] border border-white/5 rounded-3xl divide-y divide-white/5 overflow-hidden">
            <button
              onClick={() => setActiveModal('daily_limit')}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-[#FF6321]/15 text-[#FF6321] flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Limite quotidienne</p>
                  <p className="text-[11px] text-white/50">
                    {screenTime.dailyLimitMinutes
                      ? `${screenTime.dailyLimitMinutes} minutes par jour`
                      : 'Désactivée'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>

            <button
              onClick={() => {
                setSleepTime(screenTime.sleepStartHour || '22:30');
                setActiveModal('sleep_reminder');
              }}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Rappel d'heure du coucher</p>
                  <p className="text-[11px] text-white/50">
                    {screenTime.sleepReminderEnabled
                      ? `Actif à ${screenTime.sleepStartHour || '22:30'}`
                      : 'Désactivé'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>
          </div>
        </div>
      </main>

      {/* MODAL 1: LIMITE QUOTIDIENNE */}
      {activeModal === 'daily_limit' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Définir une limite quotidienne</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {[
                { val: 40, label: '40 minutes' },
                { val: 60, label: '60 minutes (Recommandé)' },
                { val: 90, label: '90 minutes' },
                { val: 120, label: '2 heures' },
                { val: null, label: 'Désactiver la limite' }
              ].map((opt) => (
                <button
                  key={String(opt.val)}
                  onClick={() => handleSelectDailyLimit(opt.val)}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between text-left text-xs transition ${
                    screenTime.dailyLimitMinutes === opt.val
                      ? 'bg-[#FF6321]/15 border border-[#FF6321] text-white font-bold'
                      : 'bg-white/5 border border-white/5 text-white/70'
                  }`}
                >
                  <span>{opt.label}</span>
                  {screenTime.dailyLimitMinutes === opt.val && <Check className="w-4 h-4 text-[#FF6321]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: HEURE DU COUCHER */}
      {activeModal === 'sleep_reminder' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Heure du coucher</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/60">
              Choisissez l'heure à laquelle vous souhaitez recevoir un rappel de pause nocturne.
            </p>

            <div>
              <label className="text-[11px] font-bold text-white/50 block mb-1">Heure de rappel</label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF6321]"
              />
            </div>

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleSaveSleepReminder(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition"
              >
                Désactiver
              </button>
              <button
                type="button"
                onClick={() => handleSaveSleepReminder(true)}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#E05316] text-white transition shadow"
              >
                Activer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
