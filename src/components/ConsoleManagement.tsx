import React, { useState } from 'react';
import { PlayStationConsole, ClientSession, User, ConsoleType } from '../types';
import { Gamepad2, Plus, Wrench, Trash2, Power, Check, AlertTriangle, Shield, Coins, MonitorPlay } from 'lucide-react';

interface ConsoleManagementProps {
  consoles: PlayStationConsole[];
  sessions: ClientSession[];
  currentUser: User;
  onCreateConsole: (consoleData: { name: string; type: ConsoleType; status: 'active' | 'maintenance' }) => void;
  onToggleStatus: (id: string) => void;
  onDeleteConsole: (id: string) => void;
  isLoading: boolean;
}

export default function ConsoleManagement({
  consoles,
  sessions,
  currentUser,
  onCreateConsole,
  onToggleStatus,
  onDeleteConsole,
  isLoading
}: ConsoleManagementProps) {
  const [consoleName, setConsoleName] = useState('');
  const [consoleType, setConsoleType] = useState<ConsoleType>('ps5');
  const [consoleStatus, setConsoleStatus] = useState<'active' | 'maintenance'>('active');
  const [formError, setFormError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!consoleName.trim()) {
      setFormError('Le nom de la console est requis.');
      return;
    }

    onCreateConsole({
      name: consoleName.trim(),
      type: consoleType,
      status: consoleStatus
    });

    setConsoleName('');
    setConsoleType('ps5');
    setConsoleStatus('active');
  };

  const getConsoleOccupiedState = (consoleNameStr: string) => {
    // Find if there's any active running/pending session with this console name/number
    const isOccupied = sessions.some(
      s => s.paymentStatus === 'pending' && s.consoleNumber.toLowerCase() === consoleNameStr.toLowerCase()
    );
    return isOccupied;
  };

  // Only Director or Admin can edit/create. Raw users / Operators can only view!
  const canManage = currentUser.role === 'director' || currentUser.role === 'admin';

  return (
    <div className="space-y-6 text-white" id="console-management-tab">
      {/* Header row */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Gamepad2 size={24} className="text-yellow-500 animate-pulse" />
          Régie & Configuration des Consoles PlayStation
        </h2>
        <p className="text-zinc-500 text-xs text-left">
          Ajoutez de nouvelles fiches de consoles PlayStation, pilotez l'état de maintenance et suivez leur taux d'occupation en temps réel.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Creation Form (Col 1) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#141414] border border-zinc-800 rounded-xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-yellow-500 mb-4 flex items-center gap-2">
              <Plus size={16} />
              Enregistrer une Console
            </h3>

            {canManage ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 font-medium text-xs rounded-lg">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Nom / Numéro Unique <span className="text-yellow-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Console 13"
                    value={consoleName}
                    onChange={(e) => setConsoleName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 px-3 py-2 text-sm text-white placeholder-zinc-600 rounded-lg focus:outline-none focus:border-yellow-500 hover:border-zinc-800 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Génération PlayStation
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['ps5', 'ps4', 'ps3'] as ConsoleType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setConsoleType(type)}
                        className={`py-2 text-xs font-bold rounded-lg border uppercase transition ${
                          consoleType === type
                            ? 'bg-yellow-500/15 border-yellow-500 text-yellow-500'
                            : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                        }`}
                      >
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Statut Initial
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConsoleStatus('active')}
                      className={`py-2 text-xs font-bold rounded-lg border transition ${
                        consoleStatus === 'active'
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      En Service
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsoleStatus('maintenance')}
                      className={`py-2 text-xs font-bold rounded-lg border transition ${
                        consoleStatus === 'maintenance'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                          : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-850'
                      }`}
                    >
                      Maintenance
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-[#09090b] font-bold text-xs uppercase px-4 py-2.5 rounded-lg transition tracking-wide flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Plus size={16} />
                    {isLoading ? 'Enregistrement...' : 'Créer la Console'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 bg-zinc-900/50 border border-zinc-800/40 rounded-xl text-center text-zinc-500 space-y-2">
                <Shield size={24} className="mx-auto text-zinc-650" />
                <p className="text-xs">Seuls les directeurs ou administrateurs ont le droit de créer ou configurer les PlayStation.</p>
              </div>
            )}
          </div>

          <div className="bg-[#141414] border border-zinc-800 rounded-xl p-5 shadow-xl">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Coins size={16} className="text-yellow-500" />
              Barème des Gains standard
            </h3>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex justify-between border-b border-zinc-850 pb-1.5">
                <span>PlayStation 5</span>
                <span className="text-yellow-500 font-bold">0.50 $ / match</span>
              </li>
              <li className="flex justify-between border-b border-zinc-850 pb-1.5">
                <span>PlayStation 4</span>
                <span className="text-yellow-500 font-bold">0.25 $ / match</span>
              </li>
              <li className="flex justify-between pb-0.5">
                <span>PlayStation 3</span>
                <span className="text-yellow-500 font-bold">0.10 $ / match</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Consoles Showcase List (Col 2 & 3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#141414] border border-zinc-800 rounded-xl p-5 shadow-xl min-h-[460px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-yellow-500 flex items-center gap-2">
                <MonitorPlay size={16} />
                Parc de Consoles ({consoles.length})
              </h3>
              
              <div className="text-xs font-mono text-zinc-500 bg-zinc-900 border border-zinc-850 px-2 py-1 rounded">
                Actives: {consoles.filter(c => c.status === 'active').length} | En panne: {consoles.filter(c => c.status === 'maintenance').length}
              </div>
            </div>

            {consoles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-80 text-zinc-500 space-y-3">
                <Gamepad2 size={48} className="text-zinc-700 animate-pulse" />
                <p className="text-xs">Aucune console enregistrée. Utilisez le formulaire pour en ajouter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {consoles.map((item) => {
                  const isBusy = getConsoleOccupiedState(item.name);
                  const isMaintenance = item.status === 'maintenance';

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition duration-200 relative ${
                        isMaintenance
                          ? 'bg-amber-500/5 [background-image:repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(245,158,11,0.02)_8px,rgba(245,158,11,0.02)_16px)] border-amber-500/15'
                          : isBusy
                          ? 'bg-blue-500/5 border-blue-500/15'
                          : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-850'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-base tracking-tight">{item.name}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.type === 'ps5'
                                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/10'
                                : item.type === 'ps4'
                                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/10'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                            }`}>
                              {item.type.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            Enregistrée le {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>

                        {/* Status chip */}
                        {isMaintenance ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                            <Wrench size={10} />
                            En Maintenance
                          </span>
                        ) : isBusy ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                            Occupée
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Libre / Actif
                          </span>
                        )}
                      </div>

                      {/* Info & Admin controls */}
                      <div className="flex items-center justify-between pt-3 border-t border-zinc-850 md:mt-2">
                        <span className="text-[11px] text-zinc-500">
                          Tarif: {item.type === 'ps5' ? '0.50 $' : item.type === 'ps4' ? '0.25 $' : '0.10 $'} / m
                        </span>

                        {canManage ? (
                          <div className="flex gap-1.5">
                            {/* Toggle maintenance */}
                            <button
                              onClick={() => onToggleStatus(item.id)}
                              title={isMaintenance ? "Remettre en service" : "Changer en maintenance"}
                              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                isMaintenance
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/15'
                                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/15'
                              }`}
                            >
                              <Power size={13} />
                            </button>

                            {/* Delete */}
                            {showDeleteConfirm === item.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => onDeleteConsole(item.id)}
                                  className="px-2 py-1 bg-red-500 hover:bg-red-600 text-zinc-950 font-bold text-[10px] uppercase rounded transition cursor-pointer"
                                >
                                  Supprimer
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(null)}
                                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 text-[10px] rounded transition cursor-pointer"
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowDeleteConfirm(item.id)}
                                title="Supprimer la console définitivement"
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/10 hover:text-red-500 border border-zinc-700/50 hover:border-red-500/20 text-zinc-400 transition cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-600 italic">Lecture seule</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
