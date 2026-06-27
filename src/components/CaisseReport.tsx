import React, { useState, useMemo } from 'react';
import { ClientSession, User, GameRoom } from '../types';
import { FileSpreadsheet, Search, ChevronDown, ChevronRight, Plus, Minus, Building, Gamepad2, UserCheck, Wallet, RefreshCw, Printer, Coins, Smartphone, CreditCard } from 'lucide-react';
import InvoicePrint from './InvoicePrint';

interface CaisseReportProps {
  sessions: ClientSession[];
  users: User[];
  rooms: GameRoom[];
  currentUser: User;
  onRefresh?: () => void;
}

const getLocalDateString = (isoString?: string | null) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    if (isoString.includes('T')) {
      return isoString.split('T')[0];
    }
    return isoString;
  }
};

export default function CaisseReport({ sessions, users, rooms, currentUser, onRefresh }: CaisseReportProps) {
  // Sub-tabs: 'emplacement' | 'console' | 'secretaire' | 'collecter'
  const [activeSubTab, setActiveSubTab] = useState<'emplacement' | 'console' | 'secretaire' | 'collecter'>('secretaire');
  
  // Date filter state (defaults to today's local date YYYY-MM-DD)
  const [filterDate, setFilterDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Search filter for details tables
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  
  // Expand/collapse states for agent/room/console groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Active invoice for printer preview
  const [activeInvoice, setActiveInvoice] = useState<ClientSession | null>(null);

  // Filter sessions that are 'paid' (cash validations) and match the selected date (if set)
  const paidSessions = useMemo(() => {
    return sessions.filter(s => {
      if (s.paymentStatus !== 'paid') return false;
      if (!filterDate) return true;
      
      // Match with the updated/validated date in local timezone
      const sessionDate = s.validatedDate || (s.updatedAt ? getLocalDateString(s.updatedAt) : getLocalDateString(s.createdAt));
      return sessionDate === filterDate;
    });
  }, [sessions, filterDate]);

  // Expand/collapse helper
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleSearchChange = (groupId: string, value: string) => {
    setSearchTerms(prev => ({
      ...prev,
      [groupId]: value
    }));
  };

  // Clear date filter
  const handleClearDate = () => {
    setFilterDate('');
  };

  // User permission filtering logic:
  // - Director: can see everything.
  // - Admin: sees validations under their authority.
  // - User: sees only themselves.
  const visibleUsers = useMemo(() => {
    if (currentUser.role === 'director') {
      return users;
    }
    if (currentUser.role === 'admin') {
      // The `users` list from props is already filtered to only contains users under the admin's authority,
      // but let's double-check or ensure we keep users that match.
      return users;
    }
    // Simple users can only see themselves
    return users.filter(u => u.id === currentUser.id);
  }, [users, currentUser]);

  // Filter visible sessions according to user role permissions
  const visiblePaidSessions = useMemo(() => {
    if (currentUser.role === 'director') {
      return paidSessions;
    }
    if (currentUser.role === 'admin') {
      // Admins see validations of users under their authority
      const allowedUserIds = visibleUsers.map(u => u.id);
      return paidSessions.filter(s => s.paymentValidatedBy && allowedUserIds.includes(s.paymentValidatedBy));
    }
    // Simple users see only sessions validated by themselves
    return paidSessions.filter(s => s.paymentValidatedBy === currentUser.id);
  }, [paidSessions, visibleUsers, currentUser]);

  // ==================== Grouping Calculations ====================

  // 1. Grouping: PAIEMENTS PAR SECRÉTAIRE / AGENT
  const secretaryGroups = useMemo(() => {
    const groups: Record<string, { user: User; count: number; total: number; sessions: ClientSession[] }> = {};

    // Initialize with all visible users to show zero validations too
    visibleUsers.forEach(u => {
      groups[u.id] = {
        user: u,
        count: 0,
        total: 0,
        sessions: []
      };
    });

    // Populate with validated sessions
    visiblePaidSessions.forEach(s => {
      const validatorId = s.paymentValidatedBy || '';
      if (groups[validatorId]) {
        groups[validatorId].count += 1;
        groups[validatorId].total += s.totalAmount;
        groups[validatorId].sessions.push(s);
      } else if (validatorId) {
        // Fallback for case where validator user details are not in visible users but present in sessions
        const unknownUser: User = {
          id: validatorId,
          username: s.paymentValidatedByName || 'Inconnu',
          name: s.paymentValidatedByName || 'Inconnu',
          role: 'user',
          createdBy: null,
          isLocked: false,
          status: 'offline',
          lastActive: 0
        };
        groups[validatorId] = {
          user: unknownUser,
          count: 1,
          total: s.totalAmount,
          sessions: [s]
        };
      }
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [visibleUsers, visiblePaidSessions]);

  // 2. Grouping: PAIEMENTS PAR EMPLACEMENT (GAMING ROOMS)
  const roomGroups = useMemo(() => {
    const groups: Record<string, { roomName: string; roomId: string; count: number; total: number; sessions: ClientSession[] }> = {};

    // Initialize with known rooms
    rooms.forEach(r => {
      groups[r.id] = {
        roomName: r.name,
        roomId: r.id,
        count: 0,
        total: 0,
        sessions: []
      };
    });
    // Add default room
    groups['room-default'] = {
      roomName: 'Salle Principale',
      roomId: 'room-default',
      count: 0,
      total: 0,
      sessions: []
    };

    visiblePaidSessions.forEach(s => {
      const rId = s.roomId || 'room-default';
      if (!groups[rId]) {
        groups[rId] = {
          roomName: rId === 'room-default' ? 'Salle Principale' : `Salle (${rId})`,
          roomId: rId,
          count: 0,
          total: 0,
          sessions: []
        };
      }
      groups[rId].count += 1;
      groups[rId].total += s.totalAmount;
      groups[rId].sessions.push(s);
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [rooms, visiblePaidSessions]);

  // 3. Grouping: PAIEMENTS PAR TYPE DE CONSOLE
  const consoleGroups = useMemo(() => {
    const groups: Record<string, { name: string; type: string; count: number; total: number; sessions: ClientSession[] }> = {
      'ps5': { name: 'PlayStation 5 ($0.50 / match)', type: 'ps5', count: 0, total: 0, sessions: [] },
      'ps4': { name: 'PlayStation 4 ($0.25 / match)', type: 'ps4', count: 0, total: 0, sessions: [] },
      'ps3': { name: 'PlayStation 3 ($0.10 / match)', type: 'ps3', count: 0, total: 0, sessions: [] }
    };

    visiblePaidSessions.forEach(s => {
      const type = s.consoleType;
      if (groups[type]) {
        groups[type].count += 1;
        groups[type].total += s.totalAmount;
        groups[type].sessions.push(s);
      }
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [visiblePaidSessions]);

  // 4. Grouping: MONTANT À COLLECTER (Aggregate total cash details)
  const collecterData = useMemo(() => {
    const totalCash = visiblePaidSessions.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalDrinks = visiblePaidSessions.reduce((acc, s) => acc + (s.drinksCount || 0), 0);
    const totalDrinksAmt = visiblePaidSessions.reduce((acc, s) => acc + (s.drinksAmount || 0), 0);
    const totalSnacks = visiblePaidSessions.reduce((acc, s) => acc + (s.snacksCount || 0), 0);
    const totalSnacksAmt = visiblePaidSessions.reduce((acc, s) => acc + (s.snacksAmount || 0), 0);
    const totalMatchAmt = totalCash - totalDrinksAmt - totalSnacksAmt;

    const totalByMethod = {
      cash: 0,
      mobile_money: 0,
      card: 0
    };

    const countByMethod = {
      cash: 0,
      mobile_money: 0,
      card: 0
    };

    visiblePaidSessions.forEach(s => {
      const method = s.paymentMethod || 'cash';
      if (method === 'mobile_money') {
        totalByMethod.mobile_money += s.totalAmount;
        countByMethod.mobile_money += 1;
      } else if (method === 'card') {
        totalByMethod.card += s.totalAmount;
        countByMethod.card += 1;
      } else {
        totalByMethod.cash += s.totalAmount;
        countByMethod.cash += 1;
      }
    });

    return {
      totalCash,
      totalDrinks,
      totalDrinksAmt,
      totalSnacks,
      totalSnacksAmt,
      totalMatchAmt,
      totalByMethod,
      countByMethod,
      validationsCount: visiblePaidSessions.length
    };
  }, [visiblePaidSessions]);

  // Grand total sum of all visible validations
  const grandTotalAll = useMemo(() => {
    return visiblePaidSessions.reduce((acc, s) => acc + s.totalAmount, 0);
  }, [visiblePaidSessions]);

  return (
    <div className="space-y-6 text-white" id="caisse-report-tab">
      
      {/* Header with blue and dark layout */}
      <div className="bg-[#141414] border border-zinc-800 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet size={22} className="text-yellow-500 animate-pulse" />
              Rapport de caisse {filterDate ? `pour le ${new Date(filterDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : "Global"}
            </h2>
            <p className="text-zinc-500 text-xs mt-1">
              Visualisation des ventes de la journée, suivi des validations des collaborateurs et des montants à collecter.
            </p>
          </div>

          {/* Action buttons and Date Filter */}
          <div className="flex flex-wrap items-center gap-3">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 bg-zinc-850 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Actualiser les données"
              >
                <RefreshCw size={15} />
              </button>
            )}

            {/* FACTURES & STATS indicators as styled pills */}
            <div className="flex bg-[#0a0a0a] border border-zinc-800 p-1 rounded-lg">
              <button className="bg-blue-600 text-white font-extrabold text-[10px] uppercase px-3 py-1.5 rounded transition-all tracking-wider select-none">
                Factures Journalières
              </button>
              <button className="text-zinc-400 hover:text-zinc-200 font-extrabold text-[10px] uppercase px-3 py-1.5 rounded transition-all tracking-wider select-none">
                Stats de Caisse
              </button>
            </div>

            {/* Date Picker styled like the screenshot */}
            <div className="bg-[#0f0f0f] border border-zinc-800 px-3 py-1.5 rounded-lg flex items-center gap-2 relative text-xs">
              <div className="flex flex-col text-left">
                <span className="text-[9px] text-zinc-500 font-bold uppercase leading-none">Date</span>
                <input
                  type="date"
                  className="bg-transparent border-none text-white font-bold outline-none cursor-pointer mt-0.5 text-xs text-yellow-500 font-sans"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                />
              </div>
              {filterDate && (
                <button
                  onClick={handleClearDate}
                  className="text-zinc-500 hover:text-red-500 transition-colors ml-1 cursor-pointer p-0.5"
                  title="Effacer le filtre date"
                >
                  &times;
                </button>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Visual payment methods overview bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="payment-methods-overview">
        {/* Cash Card */}
        <div className="bg-[#141414] border border-zinc-800/80 rounded-xl p-4 flex items-center justify-between shadow-md relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Règlements Cash / Espèces</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-black text-yellow-500">{collecterData.totalByMethod.cash.toFixed(2)} $</span>
              <span className="text-[10px] font-bold text-zinc-400">
                ({collecterData.totalCash > 0 ? ((collecterData.totalByMethod.cash / collecterData.totalCash) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 block font-semibold">
              {collecterData.countByMethod.cash} transaction{collecterData.countByMethod.cash > 1 ? 's' : ''} validée{collecterData.countByMethod.cash > 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-lg">
            <Coins size={22} />
          </div>
        </div>

        {/* Mobile Money Card */}
        <div className="bg-[#141414] border border-zinc-800/80 rounded-xl p-4 flex items-center justify-between shadow-md relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Paiements Mobile Money</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-black text-blue-400">{collecterData.totalByMethod.mobile_money.toFixed(2)} $</span>
              <span className="text-[10px] font-bold text-zinc-400">
                ({collecterData.totalCash > 0 ? ((collecterData.totalByMethod.mobile_money / collecterData.totalCash) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 block font-semibold">
              {collecterData.countByMethod.mobile_money} transaction{collecterData.countByMethod.mobile_money > 1 ? 's' : ''} validée{collecterData.countByMethod.mobile_money > 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
            <Smartphone size={22} />
          </div>
        </div>

        {/* Credit Card Card */}
        <div className="bg-[#141414] border border-zinc-800/80 rounded-xl p-4 flex items-center justify-between shadow-md relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Paiements Carte de Crédit</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-black text-emerald-400">{collecterData.totalByMethod.card.toFixed(2)} $</span>
              <span className="text-[10px] font-bold text-zinc-400">
                ({collecterData.totalCash > 0 ? ((collecterData.totalByMethod.card / collecterData.totalCash) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 block font-semibold">
              {collecterData.countByMethod.card} transaction{collecterData.countByMethod.card > 1 ? 's' : ''} validée{collecterData.countByMethod.card > 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <CreditCard size={22} />
          </div>
        </div>
      </div>

      {/* Main navigation for Sub-Tabs */}
      <div className="flex border-b border-zinc-800" id="caisse-subtabs">
        {([
          { id: 'emplacement', label: 'PAIEMENTS PAR EMPLACEMENT', icon: Building },
          { id: 'console', label: 'PAIEMENTS PAR TYPE DE CONSOLE', icon: Gamepad2 },
          { id: 'secretaire', label: 'PAIEMENTS PAR SECRÉTAIRE', icon: UserCheck },
          { id: 'collecter', label: 'MONTANT À COLLECTER', icon: Wallet }
        ] as const).map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex-1 md:flex-none px-6 py-3.5 text-xs font-bold transition-all border-b-2 text-center uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer ${
                isActive
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5 font-black'
                  : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/20'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================== SUB-TAB CONTENT RENDERING ==================== */}

      {/* 1. TAB: PAIEMENTS PAR SECRÉTAIRE (Main interactive section with expand/collapse) */}
      {activeSubTab === 'secretaire' && (
        <div className="space-y-4" id="secretaire-tab-content">
          <div className="bg-[#141414] border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            
            <div className="bg-[#0f0f0f] px-5 py-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                Paiements validés par secrétaire / agent
              </h3>
              <span className="text-[10px] bg-blue-500/15 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                {visiblePaidSessions.length} Validation(s)
              </span>
            </div>

            {secretaryGroups.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs">
                Aucun agent ou collaborateur sous votre autorité n'a validé de paiements pour cette date.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {secretaryGroups.map(group => {
                  const isExpanded = !!expandedGroups[`user-${group.user.id}`];
                  const searchTerm = searchTerms[`user-${group.user.id}`] || '';
                  
                  // Filter sessions inside this group if user is searching
                  const filteredSessions = group.sessions.filter(s => {
                    if (!searchTerm) return true;
                    return (
                      s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      s.consoleNumber.toLowerCase().includes(searchTerm.toLowerCase())
                    );
                  });

                  return (
                    <div key={group.user.id} className="bg-[#141414]">
                      
                      {/* Master Row */}
                      <div className="p-4 flex items-center justify-between hover:bg-zinc-900/30 transition-colors">
                        <div className="flex items-center gap-4">
                          {/* Light blue round +/- button exactly like the screenshot */}
                          <button
                            onClick={() => toggleGroup(`user-${group.user.id}`)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                              isExpanded 
                                ? 'bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white' 
                                : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500 hover:text-black'
                            }`}
                          >
                            {isExpanded ? <Minus size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                          </button>

                          <div>
                            <span className="font-bold text-sm text-zinc-100 capitalize">
                              {group.user.name} 
                            </span>
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase bg-zinc-800 px-2 py-0.5 rounded ml-2 select-none">
                              {group.user.role === 'admin' ? 'Administrateur' : 'Simple caissier'}
                            </span>
                            <span className="text-xs text-zinc-500 ml-3 hidden sm:inline">
                              ({group.count} validation{group.count > 1 ? 's' : ''})
                            </span>
                          </div>
                        </div>

                        {/* Total Right aligned */}
                        <div className="font-black text-sm text-emerald-400 font-mono tracking-wide">
                          {group.total.toFixed(2)} $
                        </div>
                      </div>

                      {/* Detail Expandable Area */}
                      {isExpanded && (
                        <div className="p-5 bg-[#0a0a0a] border-t border-b border-zinc-900/80 animate-fade-in">
                          
                          {/* Inner search box */}
                          <div className="flex justify-end mb-4">
                            <div className="relative w-full max-w-xs">
                              <span className="absolute left-3 top-2.5 text-zinc-600"><Search size={14} /></span>
                              <input
                                type="text"
                                placeholder="Rechercher client, dossier..."
                                className="w-full bg-[#121212] border border-zinc-800 focus:border-blue-500 rounded px-3 py-1.5 pl-9 text-xs text-zinc-200 outline-none"
                                value={searchTerm}
                                onChange={e => handleSearchChange(`user-${group.user.id}`, e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Details Invoices Table */}
                          <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                              <thead className="bg-[#121212] text-[10px] text-blue-500 uppercase font-black tracking-wider border-b border-zinc-800/80">
                                <tr>
                                  <th className="p-3">Patient / Client</th>
                                  <th className="p-3">ID du dossier</th>
                                  <th className="p-3">Temps / Heure</th>
                                  <th className="p-3">Sous-emplacement / Salle</th>
                                  <th className="p-3 text-right">Total payé</th>
                                  <th className="p-3">Méthode</th>
                                  <th className="p-3 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-800/40">
                                {filteredSessions.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="p-6 text-center text-zinc-600 italic">
                                      Aucune transaction correspondante trouvée.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredSessions.map(sess => (
                                    <tr key={sess.id} className="hover:bg-zinc-900/20 transition-colors">
                                      <td className="p-3 font-bold text-zinc-100">{sess.clientName}</td>
                                      <td className="p-3 font-mono text-zinc-400">{sess.id.substring(0, 8)}...</td>
                                      <td className="p-3 text-zinc-400 font-mono">
                                        {sess.updatedAt ? new Date(sess.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                                      </td>
                                      <td className="p-3">
                                        <span className="bg-zinc-900 px-2 py-0.5 rounded text-[10px] text-zinc-300 font-mono border border-zinc-800/80 mr-2 uppercase">
                                          {sess.consoleType}
                                        </span>
                                        Console N°{sess.consoleNumber}
                                      </td>
                                      <td className="p-3 text-right font-black text-emerald-400 font-mono">
                                        {sess.totalAmount.toFixed(2)} $
                                      </td>
                                      <td className="p-3 font-semibold">
                                        {sess.paymentMethod === 'mobile_money' ? (
                                          <span className="text-blue-400">Mobile money</span>
                                        ) : sess.paymentMethod === 'card' ? (
                                          <span className="text-emerald-400">Carte de crédit</span>
                                        ) : (
                                          <span className="text-yellow-500">Espèces (Cash)</span>
                                        )}
                                      </td>
                                      <td className="p-3 text-center">
                                        <button
                                          onClick={() => setActiveInvoice(sess)}
                                          className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-yellow-500 rounded cursor-pointer transition-all border border-zinc-800/80"
                                          title="Imprimer le reçu"
                                        >
                                          <Printer size={12} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                                
                                {/* Inner group summary row */}
                                <tr className="bg-[#121212] font-black border-t border-zinc-800">
                                  <td colSpan={4} className="p-3 text-blue-400 uppercase tracking-wider font-extrabold text-[10px]">
                                    Sous-total pour {group.user.name}
                                  </td>
                                  <td className="p-3 text-right text-emerald-400 font-mono font-black text-xs">
                                    {group.total.toFixed(2)} $
                                  </td>
                                  <td colSpan={2} className="p-3"></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom aggregate Grand Total banner similar to screenshot */}
            <div className="bg-blue-900/20 border-t border-zinc-800 p-4 flex justify-between items-center">
              <span className="font-extrabold text-xs text-blue-400 uppercase tracking-wider">
                Total De La Journée (Validations)
              </span>
              <span className="font-black text-lg text-emerald-400 font-mono">
                {grandTotalAll.toFixed(2)} $
              </span>
            </div>

          </div>
        </div>
      )}

      {/* 2. TAB: PAIEMENTS PAR EMPLACEMENT (Grouping by gaming rooms) */}
      {activeSubTab === 'emplacement' && (
        <div className="space-y-4" id="emplacement-tab-content">
          <div className="bg-[#141414] border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            
            <div className="bg-[#0f0f0f] px-5 py-4 border-b border-zinc-800">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                Paiements par salle de jeux
              </h3>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {roomGroups.map(group => {
                const isExpanded = !!expandedGroups[`room-${group.roomId}`];
                const searchTerm = searchTerms[`room-${group.roomId}`] || '';
                
                const filteredSessions = group.sessions.filter(s => {
                  if (!searchTerm) return true;
                  return (
                    s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.id.toLowerCase().includes(searchTerm.toLowerCase())
                  );
                });

                return (
                  <div key={group.roomId} className="bg-[#141414]">
                    
                    {/* Master Row */}
                    <div className="p-4 flex items-center justify-between hover:bg-zinc-900/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleGroup(`room-${group.roomId}`)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isExpanded 
                              ? 'bg-red-500/10 border border-red-500/30 text-red-500' 
                              : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
                          }`}
                        >
                          {isExpanded ? <Minus size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                        </button>
                        <div>
                          <span className="font-bold text-sm text-zinc-100">{group.roomName}</span>
                          <span className="text-xs text-zinc-500 ml-3">({group.count} validation{group.count > 1 ? 's' : ''})</span>
                        </div>
                      </div>
                      <div className="font-black text-sm text-emerald-400 font-mono">{group.total.toFixed(2)} $</div>
                    </div>

                    {/* Expandable Table */}
                    {isExpanded && (
                      <div className="p-5 bg-[#0a0a0a] border-t border-b border-zinc-900/80">
                        <div className="flex justify-end mb-4">
                          <div className="relative w-full max-w-xs">
                            <span className="absolute left-3 top-2.5 text-zinc-600"><Search size={14} /></span>
                            <input
                              type="text"
                              placeholder="Rechercher..."
                              className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-1.5 pl-9 text-xs text-zinc-200 outline-none"
                              value={searchTerm}
                              onChange={e => handleSearchChange(`room-${group.roomId}`, e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
                          <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-[#121212] text-[10px] text-blue-500 uppercase font-black tracking-wider border-b border-zinc-800/80">
                              <tr>
                                <th className="p-3">Client</th>
                                <th className="p-3">ID du dossier</th>
                                <th className="p-3">Console</th>
                                <th className="p-3">Validé par</th>
                                <th className="p-3 text-right">Total payé</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40">
                              {filteredSessions.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-6 text-center text-zinc-600 italic">
                                    Aucune transaction enregistrée.
                                  </td>
                                </tr>
                              ) : (
                                filteredSessions.map(sess => (
                                  <tr key={sess.id} className="hover:bg-zinc-900/20 transition-colors">
                                    <td className="p-3 font-bold text-zinc-100">{sess.clientName}</td>
                                    <td className="p-3 font-mono text-zinc-400">{sess.id.substring(0, 8)}...</td>
                                    <td className="p-3 text-zinc-300 font-mono">{sess.consoleType.toUpperCase()} - N°{sess.consoleNumber}</td>
                                    <td className="p-3 capitalize text-zinc-400">{sess.paymentValidatedByName || 'Inconnu'}</td>
                                    <td className="p-3 text-right font-black text-emerald-400 font-mono">{sess.totalAmount.toFixed(2)} $</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            <div className="bg-blue-900/20 border-t border-zinc-800 p-4 flex justify-between items-center">
              <span className="font-extrabold text-xs text-blue-400 uppercase tracking-wider">Total</span>
              <span className="font-black text-lg text-emerald-400 font-mono">{grandTotalAll.toFixed(2)} $</span>
            </div>

          </div>
        </div>
      )}

      {/* 3. TAB: PAIEMENTS PAR TYPE DE CONSOLE */}
      {activeSubTab === 'console' && (
        <div className="space-y-4" id="console-tab-content">
          <div className="bg-[#141414] border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            
            <div className="bg-[#0f0f0f] px-5 py-4 border-b border-zinc-800">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                Paiements par modèle de PlayStation (Point 7 & 9)
              </h3>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {consoleGroups.map(group => {
                const isExpanded = !!expandedGroups[`console-${group.type}`];
                const searchTerm = searchTerms[`console-${group.type}`] || '';
                
                const filteredSessions = group.sessions.filter(s => {
                  if (!searchTerm) return true;
                  return (
                    s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.id.toLowerCase().includes(searchTerm.toLowerCase())
                  );
                });

                return (
                  <div key={group.type} className="bg-[#141414]">
                    
                    {/* Master Row */}
                    <div className="p-4 flex items-center justify-between hover:bg-zinc-900/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleGroup(`console-${group.type}`)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isExpanded 
                              ? 'bg-red-500/10 border border-red-500/30 text-red-500' 
                              : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
                          }`}
                        >
                          {isExpanded ? <Minus size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                        </button>
                        <div>
                          <span className="font-bold text-sm text-zinc-100 uppercase">{group.type.toUpperCase()}</span>
                          <span className="text-xs text-zinc-500 ml-3">({group.count} validation{group.count > 1 ? 's' : ''})</span>
                          <span className="text-[10px] text-zinc-500 block sm:inline sm:ml-4 font-semibold italic">{group.name}</span>
                        </div>
                      </div>
                      <div className="font-black text-sm text-emerald-400 font-mono">{group.total.toFixed(2)} $</div>
                    </div>

                    {/* Expandable Table */}
                    {isExpanded && (
                      <div className="p-5 bg-[#0a0a0a] border-t border-b border-zinc-900/80">
                        <div className="flex justify-end mb-4">
                          <div className="relative w-full max-w-xs">
                            <span className="absolute left-3 top-2.5 text-zinc-600"><Search size={14} /></span>
                            <input
                              type="text"
                              placeholder="Rechercher..."
                              className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-1.5 pl-9 text-xs text-zinc-200 outline-none"
                              value={searchTerm}
                              onChange={e => handleSearchChange(`console-${group.type}`, e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
                          <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-[#121212] text-[10px] text-blue-500 uppercase font-black tracking-wider border-b border-zinc-800/80">
                              <tr>
                                <th className="p-3">Client</th>
                                <th className="p-3">ID du dossier</th>
                                <th className="p-3">N° Console</th>
                                <th className="p-3">Validateur</th>
                                <th className="p-3 text-right">Total payé</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40">
                              {filteredSessions.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-6 text-center text-zinc-600 italic">
                                    Aucune transaction enregistrée.
                                  </td>
                                </tr>
                              ) : (
                                filteredSessions.map(sess => (
                                  <tr key={sess.id} className="hover:bg-zinc-900/20 transition-colors">
                                    <td className="p-3 font-bold text-zinc-100">{sess.clientName}</td>
                                    <td className="p-3 font-mono text-zinc-400">{sess.id.substring(0, 8)}...</td>
                                    <td className="p-3 text-zinc-300 font-mono">Console N°{sess.consoleNumber}</td>
                                    <td className="p-3 capitalize text-zinc-400">{sess.paymentValidatedByName || 'Inconnu'}</td>
                                    <td className="p-3 text-right font-black text-emerald-400 font-mono">{sess.totalAmount.toFixed(2)} $</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            <div className="bg-blue-900/20 border-t border-zinc-800 p-4 flex justify-between items-center">
              <span className="font-extrabold text-xs text-blue-400 uppercase tracking-wider">Total</span>
              <span className="font-black text-lg text-emerald-400 font-mono">{grandTotalAll.toFixed(2)} $</span>
            </div>

          </div>
        </div>
      )}

      {/* 4. TAB: MONTANT À COLLECTER (Durable cash calculations and metrics breakdown) */}
      {activeSubTab === 'collecter' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="collecter-tab-content">
          
          <div className="bg-[#141414] border border-zinc-800 rounded-xl p-5 md:col-span-2 space-y-6">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Wallet size={16} className="text-yellow-500" />
              Rapprochement et ventilations comptables
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="p-4 bg-[#0a0a0a] border border-zinc-850 rounded-lg">
                <span className="text-[10px] text-zinc-500 uppercase font-black block">Validations de Matchs</span>
                <span className="text-2xl font-mono font-black text-yellow-500 block mt-1">
                  {collecterData.totalMatchAmt.toFixed(2)} $
                </span>
                <span className="text-[10px] text-zinc-600 block mt-1">
                  Calculé sur base des tarifs PlayStation validés
                </span>
              </div>

              <div className="p-4 bg-[#0a0a0a] border border-zinc-850 rounded-lg">
                <span className="text-[10px] text-zinc-500 uppercase font-black block">Consommables Soldés</span>
                <span className="text-2xl font-mono font-black text-emerald-400 block mt-1">
                  {(collecterData.totalDrinksAmt + collecterData.totalSnacksAmt).toFixed(2)} $
                </span>
                <span className="text-[10px] text-zinc-600 block mt-1">
                  Canettes : {collecterData.totalDrinks} ({collecterData.totalDrinksAmt.toFixed(2)}$) | Snacks : {collecterData.totalSnacks} ({collecterData.totalSnacksAmt.toFixed(2)}$)
                </span>
              </div>

            </div>

            {/* Explanatory text card */}
            <div className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-lg text-xs text-zinc-400 space-y-2">
              <p className="font-extrabold text-zinc-300">💡 À l'attention de l'administrateur / gérant :</p>
              <p>
                Le montant total à collecter représente la somme physique de devises encaissées par vos collaborateurs et agents au comptoir pour la date filtrée.
              </p>
              <p>
                En cas d'écart de caisse lors du prélèvement des fonds, veuillez vérifier le journal des validations individuelles ci-dessus par rapport aux reçus de caisse imprimés.
              </p>
            </div>
          </div>

          <div className="bg-[#141414] border-2 border-emerald-500/20 rounded-xl p-6 text-center flex flex-col justify-between shadow-xl relative overflow-hidden">
            {/* Ambient backlight */}
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="space-y-3 relative z-10">
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">
                Montant total net à collecter
              </span>
              <p className="text-4xl font-mono font-black text-emerald-400">
                {collecterData.totalCash.toFixed(2)} $
              </p>
              <p className="text-[11px] text-zinc-500 font-semibold uppercase">
                {collecterData.validationsCount} transactions payées validées
              </p>
            </div>

            <div className="mt-8 border-t border-zinc-800/80 pt-4 relative z-10 text-xs text-zinc-500 text-left space-y-2">
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span>Devise comptable :</span>
                <span className="font-bold text-zinc-300">Dollars Américains ($)</span>
              </div>
              <div className="space-y-1 pt-1.5">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Répartition par mode :</span>
                <div className="flex justify-between items-center text-[11px] py-0.5 border-b border-zinc-900">
                  <span className="text-yellow-500">Cash / Espèces :</span>
                  <span className="font-mono font-bold text-yellow-500">{collecterData.totalByMethod.cash.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between items-center text-[11px] py-0.5 border-b border-zinc-900">
                  <span className="text-blue-400">Mobile Money :</span>
                  <span className="font-mono font-bold text-blue-400">{collecterData.totalByMethod.mobile_money.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between items-center text-[11px] py-0.5">
                  <span className="text-emerald-400">Carte bancaire :</span>
                  <span className="font-mono font-bold text-emerald-400">{collecterData.totalByMethod.card.toFixed(2)} $</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Reusable printer print Modal */}
      {activeInvoice && (
        <InvoicePrint 
          session={activeInvoice} 
          cashierName={activeInvoice.paymentValidatedByName || currentUser.name}
          onClose={() => setActiveInvoice(null)}
        />
      )}

    </div>
  );
}
