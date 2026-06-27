import React from 'react';
import { DeleteRequest, User } from '../types';
import { ShieldCheck, Calendar, Check, X, ShieldAlert, Trash2 } from 'lucide-react';

interface DeleteRequestsProps {
  requests: DeleteRequest[];
  currentUser: User;
  onResolve: (id: string, action: 'approve' | 'reject') => void;
  isLoading: boolean;
}

export default function DeleteRequests({ requests, currentUser, onResolve, isLoading }: DeleteRequestsProps) {
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const historicRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6 text-white" id="delete-requests-tab">
      
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <ShieldAlert size={24} className="text-yellow-500" />
          Requêtes de Suppression de sessions (Point 11)
        </h2>
        <p className="text-zinc-500 text-xs text-left">
          Seuls les administrateurs valident les suppressions demandées par les caissiers.
        </p>
      </div>

      {/* Pending Requests Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500 block"></span>
          Demandes en Attente ({pendingRequests.length})
        </h3>

        {pendingRequests.length === 0 ? (
          <div className="bg-[#141414] border border-zinc-800 rounded-xl p-8 text-center text-zinc-500 text-xs font-semibold">
            Aucune demande de suppression en attente pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map(req => (
              <div key={req.id} className="bg-[#141414] border border-yellow-500/20 rounded-xl p-5 hover:border-yellow-500/40 transition-all space-y-4">
                
                {/* Request Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold">Demandé par</span>
                    <h4 className="font-extrabold text-sm text-white capitalize">{req.requestedByName}</h4>
                  </div>
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(req.requestedAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>

                {/* Target Session Info Box */}
                <div className="bg-black/40 border border-zinc-850 p-3 rounded-lg space-y-1">
                  <span className="text-[10px] text-yellow-500 font-extrabold uppercase">Client Cible à supprimer</span>
                  <p className="text-sm font-black text-white">{req.clientName}</p>
                  <p className="text-xs text-zinc-400">Console N° {req.consoleNumber}</p>
                </div>

                {/* Actions Row */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onResolve(req.id, 'reject')}
                    disabled={isLoading}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-red-500 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-red-500/10 transition-all"
                  >
                    <X size={14} /> Rejeter
                  </button>
                  <button
                    onClick={() => onResolve(req.id, 'approve')}
                    disabled={isLoading}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black py-2 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shadow-yellow-500/5"
                  >
                    <Check size={14} /> Valider la suppression
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historic Requests Section */}
      <div className="space-y-3 pt-4 border-t border-zinc-800/40">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-zinc-700 block"></span>
          Historique des Décisions ({historicRequests.length})
        </h3>

        {historicRequests.length === 0 ? (
          <div className="bg-[#141414] border border-zinc-800 rounded-xl p-8 text-center text-zinc-500 text-xs">
            Aucun historique de requêtes résolues.
          </div>
        ) : (
          <div className="bg-[#141414] border border-zinc-800 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#0f0f0f] text-zinc-500 uppercase tracking-wider text-[10px] border-b border-zinc-805">
                <tr>
                  <th className="p-3 font-semibold">Client</th>
                  <th className="p-3 font-semibold text-center">Console</th>
                  <th className="p-3 font-semibold">Demandeur</th>
                  <th className="p-3 font-semibold">Décision</th>
                  <th className="p-3 font-semibold">Résolu par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {historicRequests.map(req => (
                  <tr key={req.id} className="hover:bg-zinc-900/40">
                    <td className="p-3 font-bold text-yellow-500">{req.clientName}</td>
                    <td className="p-3 font-mono text-center">N° {req.consoleNumber}</td>
                    <td className="p-3 font-medium text-zinc-300 capitalize">{req.requestedByName}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide inline-block ${
                        req.status === 'approved' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                          : 'bg-red-500/10 text-red-400 border border-red-500/15'
                      }`}>
                        {req.status === 'approved' ? 'REQUÊTE APPROUVÉE ✓' : 'REQUÊTE REJETÉE ✗'}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-400 font-semibold capitalize">
                      {req.resolvedByName || 'Administrateur'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
