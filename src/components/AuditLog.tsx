import React, { useState } from 'react';
import { ActivityLog, User } from '../types';
import { History, Search, Calendar, User as UserIcon, RefreshCw, Terminal, ArrowUpDown } from 'lucide-react';

interface AuditLogProps {
  logs: ActivityLog[];
  currentUser: User;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function AuditLog({ logs, currentUser, onRefresh, isLoading }: AuditLogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Filter logs based on search term (actor username or action details)
  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.username.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.userId.toLowerCase().includes(term)
    );
  });

  // Sort logs based on timestamp
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const toggleSortOrder = () => {
    setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 text-white animate-fade-in" id="audit-log-tab">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <History size={24} className="text-yellow-500" />
            Journal d'Audit & Activités
          </h2>
          <p className="text-zinc-500 text-xs">Historique complet des actions, sessions modifiées et comptes gérés</p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20 active:bg-yellow-500/30 disabled:opacity-55 transition-all font-extrabold text-xs px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer h-[38px] uppercase tracking-wide shrink-0 font-sans"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Mise à jour...' : 'Actualiser'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141414] border border-zinc-805 rounded-xl p-5">
          <p className="text-zinc-500 text-xs uppercase font-semibold flex items-center gap-1.5">
            <Terminal size={12} className="text-yellow-500" /> Actions Totales
          </p>
          <h3 className="text-3xl font-black text-white mt-1.5">{logs.length}</h3>
          <p className="text-[10px] text-zinc-500 mt-1">Actions auditées enregistrées</p>
        </div>

        <div className="bg-[#141414] border border-zinc-805 rounded-xl p-5">
          <p className="text-zinc-500 text-xs uppercase font-semibold flex items-center gap-1.5">
            <Search size={12} className="text-yellow-500" /> Correspondances
          </p>
          <h3 className="text-3xl font-black text-yellow-500 mt-1.5">{filteredLogs.length}</h3>
          <p className="text-[10px] text-zinc-500 mt-1">Éléments filtrés actuellement</p>
        </div>

        <div className="bg-[#141414] border border-zinc-805 rounded-xl p-5">
          <p className="text-zinc-500 text-xs uppercase font-semibold flex items-center gap-1.5">
            <UserIcon size={12} className="text-yellow-500" /> Rôle d'Accès
          </p>
          <h3 className="text-3xl font-black text-green-500 mt-1.5 capitalize">{currentUser.role}</h3>
          <p className="text-[10px] text-zinc-500 mt-1">Niveau d'autorisation en cours</p>
        </div>
      </div>

      {/* Control panel & search */}
      <div className="bg-[#121212]/90 border border-zinc-800/80 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Rechercher par opérateur ou action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#18181b] border border-zinc-800 focus:border-yellow-500/80 text-zinc-300 rounded-lg pl-10 pr-4 py-2 text-xs outline-none transition-all placeholder:text-zinc-650"
          />
        </div>

        <button
          onClick={toggleSortOrder}
          className="w-full sm:w-auto px-4 py-2 bg-zinc-900 border border-zinc-850 hover:bg-zinc-805 transition-all text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer text-zinc-300"
        >
          <ArrowUpDown size={14} />
          Ordre : {sortOrder === 'desc' ? 'Plus récents en premier' : 'Plus anciens en premier'}
        </button>
      </div>

      {/* Logs Table / List */}
      <div className="bg-[#141414] border border-zinc-800 rounded-xl overflow-hidden shadow-xl" id="logs-view-container">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-805 uppercase tracking-wider text-zinc-500 bg-black/40 font-bold select-none">
                <th className="py-4 px-5 w-44">Date & Heure</th>
                <th className="py-4 px-5 w-48">Utilisateur (ID)</th>
                <th className="py-4 px-5">Description de l'Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-805/40">
              {sortedLogs.length > 0 ? (
                sortedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-805/10 transition-colors">
                    <td className="py-3 px-5 whitespace-nowrap text-zinc-400 font-mono">
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-zinc-600" />
                        {formatDate(log.timestamp)}
                      </div>
                    </td>
                    <td className="py-3 px-5 text-yellow-500 font-bold">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-yellow-500/10 text-[9px] text-[#facc15] font-black flex items-center justify-center uppercase shrink-0 border border-yellow-500/20">
                          {log.username.slice(0, 2)}
                        </div>
                        <span className="truncate max-w-[120px]" title={log.username}>{log.username}</span>
                        <span className="text-[10px] text-zinc-600 font-mono">({log.userId.slice(0, 6)})</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-zinc-300 font-medium leading-relaxed">
                      {log.action}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-zinc-500 font-semibold">
                    <History size={32} className="mx-auto text-zinc-700 mb-2" />
                    Aucun journal d'activité ne correspond à vos critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
