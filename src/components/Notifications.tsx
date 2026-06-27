import React from 'react';
import { GameNotification } from '../types';
import { Bell, BellOff, CheckCircle2, ShieldAlert, Trash2, Calendar } from 'lucide-react';

interface NotificationsProps {
  notifications: GameNotification[];
  onClear: () => void;
  isLoading: boolean;
}

export default function Notifications({ notifications, onClear, isLoading }: NotificationsProps) {
  return (
    <div className="space-y-6 text-white" id="notifications-tab">
      
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Bell size={24} className="text-yellow-500 animate-pulse" />
            Signaux & Notifications d'activités
          </h2>
          <p className="text-zinc-500 text-xs text-left">
            Signaux de validation de paiement et alertes de sécurité en temps réel (Point 13)
          </p>
        </div>

        {notifications.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs bg-zinc-805 hover:bg-zinc-800 text-yellow-500 border border-yellow-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer hover:border-yellow-550 transition-all font-semibold"
          >
            <Trash2 size={13} /> Tout effacer
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-[#141414] border border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
          <BellOff size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="font-semibold text-zinc-400">Aucun signal ou message actif</p>
          <p className="text-xs mt-1">Vous serez immédiatement notifié ici pour toute validation de paiement de caissier.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(notif => (
            <div 
              key={notif.id}
              className={`p-4 rounded-xl border flex gap-4 items-start ${
                notif.type === 'payment_validation' 
                  ? 'bg-emerald-500/5 border-emerald-500/20' 
                  : notif.type === 'delete_request'
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-zinc-900/50 border-zinc-800'
              }`}
            >
              {/* Alert Icons */}
              <div className="shrink-0 mt-0.5">
                {notif.type === 'payment_validation' ? (
                  <CheckCircle2 size={18} className="text-emerald-400" />
                ) : (
                  <ShieldAlert size={18} className="text-yellow-500" />
                )}
              </div>

              {/* Message */}
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start gap-4">
                  <h4 className={`text-sm font-extrabold uppercase tracking-wide ${
                    notif.type === 'payment_validation' ? 'text-emerald-400' : 'text-yellow-500'
                  }`}>
                    {notif.title}
                  </h4>
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(notif.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-xs text-zinc-300 font-medium leading-relaxed">{notif.message}</p>
                
                {notif.type === 'payment_validation' && (
                  <span className="inline-block bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 select-none">
                    SIGNAL VALIDE (REÇU OK)
                  </span>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
