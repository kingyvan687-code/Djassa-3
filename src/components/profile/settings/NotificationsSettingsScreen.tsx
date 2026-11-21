import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Moon, X } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import type { ClientPreferencesDTO } from '../../../services/clientService';

interface NotificationsSettingsScreenProps {
  onBack: () => void;
}

export const NotificationsSettingsScreen: React.FC<NotificationsSettingsScreenProps> = ({ onBack }) => {
  const { showToast, clientPreferences, updateClientPreferences } = useApp();

  const notifications = clientPreferences.notifications;
  const orderDeliveryPush = notifications.orderUpdates;
  const messagesPush = notifications.messages;
  const promosPush = notifications.promotions;
  const liveStreamPush = notifications.liveStreams;
  const newFollowersNotif = notifications.newFollowers;
  const emailReceipts = notifications.emailDigest;
  const smsDeliveryAlerts = notifications.smsAlerts;
  const pushEnabled = notifications.pushEnabled;

  const [dndEnabled, setDndEnabled] = useState(true);
  const [dndStartTime, setDndStartTime] = useState('22:00');
  const [dndEndTime, setDndEndTime] = useState('07:00');
  const [isDndModalOpen, setIsDndModalOpen] = useState(false);

  const updateNotifications = async (
    patch: Partial<ClientPreferencesDTO['notifications']>,
    message?: string
  ) => {
    await updateClientPreferences({
      notifications: {
        ...notifications,
        ...patch
      }
    });
    if (message) showToast(message);
  };

  return (
    <div
      id="notifications-settings-screen"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
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
            Notifications
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-16">
        <section className="mt-4">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            COMMANDES ET COURSIER MOTO
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="max-w-[80%] space-y-0.5">
                <span className="text-sm font-semibold text-white block">Notifications Push globales</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Activer ou suspendre toutes les alertes push sur cet appareil.
                </p>
              </div>
              <input
                type="checkbox"
                aria-label="Notifications Push globales"
                checked={pushEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void updateNotifications(
                    { pushEnabled: checked },
                    checked ? 'Notifications push activées' : 'Notifications push désactivées'
                  );
                }}
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="max-w-[80%] space-y-0.5">
                <span className="text-sm font-semibold text-white block">Suivi des livraisons en temps réel</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Colis préparé, pris en charge par le coursier moto, et notification d'arrivée imminente.
                </p>
              </div>
              <input
                type="checkbox"
                aria-label="Suivi des livraisons"
                checked={orderDeliveryPush}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void updateNotifications(
                    { orderUpdates: checked },
                    checked ? 'Suivi de commande activé' : 'Suivi désactivé'
                  );
                }}
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="max-w-[80%] space-y-0.5">
                <span className="text-sm font-semibold text-white block">Messages des boutiques</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Réponses des marchands d'Adjamé et alertes de stock pour vos demandes.
                </p>
              </div>
              <input
                type="checkbox"
                aria-label="Messages des boutiques"
                checked={messagesPush}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void updateNotifications(
                    { messages: checked },
                    checked ? 'Alertes messages activées' : 'Alertes messages désactivées'
                  );
                }}
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            INTERACTIONS SOCIALES
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Nouveaux abonnés & boutiques</span>
              <input
                type="checkbox"
                aria-label="Nouveaux abonnés"
                checked={newFollowersNotif}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void updateNotifications(
                    { newFollowers: checked },
                    checked ? 'Alertes abonnés activées' : 'Alertes abonnés désactivées'
                  );
                }}
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            DIFFUSIONS EN DIRECT ET BONS PLANS
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="max-w-[80%] space-y-0.5">
                <span className="text-sm font-semibold text-white block">Lives des vendeurs d'Adjamé</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Notifications lorsque vos boutiques suivies lancent un direct shopping.
                </p>
              </div>
              <input
                type="checkbox"
                aria-label="Lives vendeurs"
                checked={liveStreamPush}
                onChange={(e) =>
                  void updateNotifications({ liveStreams: e.target.checked })
                }
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="max-w-[80%] space-y-0.5">
                <span className="text-sm font-semibold text-white block">Bons plans et coupons Wave</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Remises exclusives du marché le week-end et ventes flash.
                </p>
              </div>
              <input
                type="checkbox"
                aria-label="Bons plans"
                checked={promosPush}
                onChange={(e) =>
                  void updateNotifications({ promotions: e.target.checked })
                }
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            HEURES CALMES
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <button
              onClick={() => setIsDndModalOpen(true)}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="space-y-0.5 max-w-[80%]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Ne pas déranger</span>
                  {dndEnabled && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold">
                      {dndStartTime} - {dndEndTime}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Silencier automatiquement les alertes pendant la nuit.
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>
          </div>
        </section>

        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            CANAUX EXTERNES
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Factures et reçus par e-mail</span>
              <input
                type="checkbox"
                aria-label="Reçus par email"
                checked={emailReceipts}
                onChange={(e) =>
                  void updateNotifications({ emailDigest: e.target.checked })
                }
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Alertes SMS de livraison moto</span>
              <input
                type="checkbox"
                aria-label="Alertes SMS"
                checked={smsDeliveryAlerts}
                onChange={(e) =>
                  void updateNotifications({ smsAlerts: e.target.checked })
                }
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </section>
      </main>

      {isDndModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setIsDndModalOpen(false)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-400" />
                Plage horaire Ne pas déranger
              </h3>
              <button onClick={() => setIsDndModalOpen(false)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-white/50 block mb-1">Début</label>
                <input
                  type="time"
                  value={dndStartTime}
                  onChange={(e) => setDndStartTime(e.target.value)}
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[#FF6321]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/50 block mb-1">Fin</label>
                <input
                  type="time"
                  value={dndEndTime}
                  onChange={(e) => setDndEndTime(e.target.value)}
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-[#FF6321]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setDndEnabled(false);
                  setIsDndModalOpen(false);
                  showToast('Mode silencieux automatique désactivé');
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition"
              >
                Désactiver
              </button>
              <button
                type="button"
                onClick={() => {
                  setDndEnabled(true);
                  setIsDndModalOpen(false);
                  showToast(`Heures calmes activées de ${dndStartTime} à ${dndEndTime}`);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#E05316] text-white transition shadow"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
