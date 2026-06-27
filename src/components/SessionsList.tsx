import React, { useState } from 'react';
import { ClientSession, User } from '../types';
import { Gamepad2, Phone, Coins, CheckCircle, Trash2, Printer, Search, PlusCircle, RefreshCw, Plus, Minus, X, Coffee, ShoppingBag, Smartphone, CreditCard, Edit } from 'lucide-react';
import InvoicePrint from './InvoicePrint';
import EditInvoiceModal from './EditInvoiceModal';
import { motion, AnimatePresence } from 'motion/react';

interface SessionsListProps {
  sessions: ClientSession[];
  currentUser: User;
  onValidatePayment: (id: string, paymentMethod?: 'cash' | 'mobile_money' | 'card') => void;
  onDeleteSession: (id: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  inventoryItems?: any[];
}

export default function SessionsList({
  sessions,
  currentUser,
  onValidatePayment,
  onDeleteSession,
  isLoading,
  onRefresh,
  inventoryItems
}: SessionsListProps) {
  const drinkItem = (inventoryItems || []).find(i => i.id === 'inv-boissons' || i.category === 'Boissons');
  const snackItem = (inventoryItems || []).find(i => i.id === 'inv-snacks' || i.category === 'Snacks');
  const currentDrinkStock = drinkItem ? drinkItem.quantity : 100;
  const currentSnackStock = snackItem ? snackItem.quantity : 100;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'paid'>('all');
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'ps3' | 'ps4' | 'ps5'>('all');
  const [activeInvoiceSession, setActiveInvoiceSession] = useState<ClientSession | null>(null);
  const [validatingSession, setValidatingSession] = useState<ClientSession | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'mobile_money' | 'card'>('cash');
  const [consumablesModalSession, setConsumablesModalSession] = useState<ClientSession | null>(null);
  const [addedDrinks, setAddedDrinks] = useState<number>(0);
  const [addedSnacks, setAddedSnacks] = useState<number>(0);
  const [isSavingConsumables, setIsSavingConsumables] = useState<boolean>(false);
  const [editingSession, setEditingSession] = useState<ClientSession | null>(null);

  const handleRemoveConsumable = async (sessionId: string, type: 'drinks' | 'snacks') => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer tous les ${type === 'drinks' ? 'boissons' : 'snacks'} de cette session ?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}/remove-consumable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ type })
      });
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Erreur lors de la suppression.");
        return;
      }
      onRefresh();
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion.");
    }
  };

  const handleOpenConsumablesModal = (session: ClientSession) => {
    setConsumablesModalSession(session);
    setAddedDrinks(0);
    setAddedSnacks(0);
  };

  const handleSaveConsumables = async () => {
    if (!consumablesModalSession) return;
    setIsSavingConsumables(true);
    try {
      const res = await fetch(`/api/sessions/${consumablesModalSession.id}/add-consumables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ drinksCount: addedDrinks, snacksCount: addedSnacks })
      });
      if (res.ok) {
        onRefresh();
        setConsumablesModalSession(null);
      } else {
        const err = await res.json();
        alert(err.error || "Erreur de validation.");
      }
    } catch (e) {
      alert("Erreur de connexion.");
    } finally {
      setIsSavingConsumables(false);
    }
  };

  const filteredSessions = sessions.filter(s => {
    // 1. Console type filter
    if (consoleFilter !== 'all' && s.consoleType.toLowerCase() !== consoleFilter) {
      return false;
    }

    // 2. Search query filter (client name, console number, phone number)
    const matchesSearch = 
      s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.consoleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phoneNumber.includes(searchTerm);

    if (!matchesSearch) return false;

    // 3. Payment status filter
    if (filterType === 'all') return true;
    if (filterType === 'pending') return s.paymentStatus === 'pending';
    if (filterType === 'paid') return s.paymentStatus === 'paid';
    return true;
  });

  // Calculate filtered stats specifically for current view
  const countTotal = filteredSessions.length;
  const countPending = filteredSessions.filter(s => s.paymentStatus === 'pending').length;
  const revenuePaid = filteredSessions
    .filter(s => s.paymentStatus === 'paid')
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const revenueTotal = filteredSessions.reduce((sum, s) => sum + s.totalAmount, 0);

  const getConsoleTypeColor = (type: string) => {
    switch(type) {
      case 'ps5': return 'bg-yellow-500 text-black font-extrabold';
      case 'ps4': return 'bg-yellow-400 text-black font-semibold';
      case 'ps3': return 'bg-zinc-700 text-zinc-100';
      default: return 'bg-zinc-800 text-white';
    }
  };

  return (
    <div className="space-y-6 text-white session-list-container" id="sessions-tab">
      
      {/* Header and Filter Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Gamepad2 size={24} className="text-yellow-500" />
            Sessions de Jeu Actives ({filteredSessions.length})
          </h2>
          <p className="text-zinc-500 text-xs">Suivi des consoles, paiements et factures</p>
        </div>
        
        {/* Actions Button */}
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="p-2.5 bg-[#141414] hover:bg-zinc-800 rounded-lg border border-zinc-800 hover:border-yellow-500/20 text-zinc-400 hover:text-white cursor-pointer transition-all"
            title="Actualiser les sessions"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Options Block */}
      <div className="flex flex-col lg:flex-row gap-4 bg-[#0d0d0d] p-4 rounded-xl border border-zinc-900">
        {/* Search */}
        <div className="relative flex-1 self-end w-full">
          <span className="absolute left-3.5 top-[14px] text-zinc-500"><Search size={18} /></span>
          <input
            type="text"
            placeholder="Rechercher par client, console, téléphone..."
            className="w-full bg-[#141414] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2.5 pl-11 pr-4 text-sm text-white placeholder-zinc-600 outline-none transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters Selectors split in columns */}
        <div className="flex flex-col sm:flex-row gap-4 shrink-0">
          {/* Console Type Filters */}
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-initial">
            <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider px-1">Type de Console</span>
            <div className="bg-[#141414] border border-zinc-800 p-1 rounded-lg flex gap-1 w-full justify-between sm:justify-start">
              {(['all', 'ps3', 'ps4', 'ps5'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setConsoleFilter(type)}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-md uppercase transition-all cursor-pointer ${
                    consoleFilter === type
                      ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-805'
                  }`}
                >
                  {type === 'all' ? 'Toutes' : type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Tab filters */}
          <div className="flex flex-col gap-1.5 flex-1 sm:flex-initial">
            <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider px-1">Statut du Paiement</span>
            <div className="bg-[#141414] border border-zinc-800 p-1 rounded-lg flex gap-1 w-full justify-between sm:justify-start">
              {(['all', 'pending', 'paid'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-md uppercase transition-all cursor-pointer ${
                    filterType === type
                      ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-805'
                  }`}
                >
                  {type === 'all' ? 'Tous' : type === 'pending' ? 'En Attente' : 'Validés'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Summary Statistics Line */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#0a0a0a] p-3 rounded-xl border border-zinc-900 text-sm">
        <div className="bg-[#141414]/40 p-2.5 rounded-lg border border-zinc-900/40 flex flex-col justify-center">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">Sessions Affichées</span>
          <span className="text-base font-black text-white mt-0.5">
            {countTotal} <span className="text-xs font-normal text-zinc-500">sessions</span>
          </span>
        </div>
        <div className="bg-[#141414]/40 p-2.5 rounded-lg border border-zinc-900/40 flex flex-col justify-center">
          <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">Sessions Actives (En cours)</span>
          <span className="text-base font-black text-yellow-500 mt-0.5">
            {countPending} <span className="text-xs font-normal text-zinc-500">actives</span>
          </span>
        </div>
        <div className="bg-[#141414]/40 p-2.5 rounded-lg border border-zinc-900/40 flex flex-col justify-center">
          <span className="text-[10px] text-emerald-500/80 font-extrabold uppercase tracking-wider">Revenu Encaissé (Vue)</span>
          <span className="text-base font-black text-emerald-400 mt-0.5">
            ${revenuePaid.toFixed(2)}
          </span>
        </div>
        <div className="bg-[#141414]/40 p-2.5 rounded-lg border border-zinc-900/40 flex flex-col justify-center">
          <span className="text-[10px] text-yellow-500/80 font-extrabold uppercase tracking-wider">Cumul Total (Vue)</span>
          <span className="text-base font-black text-yellow-500 mt-0.5">
            ${revenueTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <motion.div
          key={`empty-${searchTerm}-${filterType}-${consoleFilter}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="bg-[#141414] border border-zinc-800/80 rounded-xl p-12 text-center text-zinc-500"
        >
          <p className="font-semibold text-zinc-400">Aucune session trouvée</p>
          <p className="text-xs mt-1">Créez un nouveau client pour enregistrer de l'activité PlayStation.</p>
        </motion.div>
      ) : (
        <motion.div 
          layout
          key={`sessions-list-${searchTerm}-${filterType}-${consoleFilter}`}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredSessions.map(session => {
              const sessionTime = new Date(session.createdAt).getTime();
              const elapsedMs = Date.now() - sessionTime;
              const isOverdue = session.paymentStatus === 'pending' && elapsedMs > 3 * 3600 * 1000;
              const hoursFloat = (elapsedMs / (3600 * 1000)).toFixed(1);

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  key={session.id}
                  className={`bg-[#141414] border rounded-xl overflow-hidden hover:scale-[1.01] transition-all flex flex-col justify-between ${
                    isOverdue
                      ? 'border-red-500 shadow-xl shadow-red-500/15 ring-1 ring-red-500/40 animate-pulse'
                      : session.paymentStatus === 'paid' 
                      ? 'border-zinc-800/80' 
                      : 'border-yellow-500/20 shadow-lg shadow-yellow-500/[0.02]'
                  }`}
                >
                  
                  {/* Card top bar */}
                  <div className="p-4 border-b border-zinc-800/40 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex gap-1.5 items-center">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-black tracking-wider ${getConsoleTypeColor(session.consoleType)}`}>
                          {session.consoleType.toUpperCase()}
                        </span>
                        {isOverdue && (
                          <span className="bg-red-650 bg-red-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded animate-bounce tracking-widest leading-none">
                            🚨 ALERTE &gt;3H
                          </span>
                        )}
                      </div>
                      
                      {/* Status label */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                        session.paymentStatus === 'paid' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : isOverdue
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                      }`}>
                        {session.paymentStatus === 'paid' ? 'VALIDÉ / PAYÉ' : isOverdue ? `IMPAYÉ (${hoursFloat}H)` : 'EN ATTENTE'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-base text-yellow-500 leading-tight">{session.clientName}</h4>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
                        <Phone size={12} />
                        <span>{session.phoneNumber || 'Aucun téléphone'}</span>
                      </div>
                    </div>
                  </div>

                {/* Card Body - Gaming metrics */}
                <div className="p-4 bg-black/30 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Console Number */}
                    <div className="bg-zinc-900/40 border border-zinc-800/20 p-2.5 rounded">
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold">Numéro Console</span>
                      <p className="text-sm font-black text-white mt-0.5 uppercase">N° {session.consoleNumber}</p>
                    </div>
                    {/* Match Count */}
                    <div className="bg-zinc-900/40 border border-zinc-800/20 p-2.5 rounded">
                      <span className="text-[10px] text-zinc-500 uppercase font-semibold">Matchs Joués</span>
                      <p className="text-sm font-black text-white mt-0.5">{session.matchesCount} matches</p>
                    </div>
                  </div>

                  {/* Detailed breakdown on card */}
                  <div className="bg-black/45 p-2.5 rounded-lg space-y-1 border border-zinc-900/60 text-xs my-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-500">Ticket PS ({session.matchesCount} × ${session.costPerMatch.toFixed(2)}) :</span>
                      <span className="text-zinc-300 font-bold">${(session.matchesCount * session.costPerMatch).toFixed(2)}</span>
                    </div>
                    {session.drinksCount ? (
                      <div className="flex justify-between text-[11px] items-center">
                        <span className="text-zinc-500">Boissons ({session.drinksCount} × $0.80) :</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-300 font-bold">${(session.drinksCount * 0.8).toFixed(2)}</span>
                          {(currentUser.role === 'admin' || currentUser.role === 'director') && (
                            <button
                              onClick={() => handleRemoveConsumable(session.id, 'drinks')}
                              className="text-red-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                              title="Supprimer les boissons"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                    {session.snacksCount ? (
                      <div className="flex justify-between text-[11px] items-center">
                        <span className="text-zinc-500">Snacks ({session.snacksCount} × $1.00) :</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-300 font-bold">${(session.snacksCount * 1.0).toFixed(2)}</span>
                          {(currentUser.role === 'admin' || currentUser.role === 'director') && (
                            <button
                              onClick={() => handleRemoveConsumable(session.id, 'snacks')}
                              className="text-red-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                              title="Supprimer les snacks"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                    <div className="border-t border-zinc-800/60 my-1 pt-1 flex justify-between items-baseline">
                      <span className="text-[10px] text-zinc-400 font-black uppercase">Net à Payer :</span>
                      <span className="text-base font-black text-yellow-500">${session.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {(session.paymentStatus === 'pending' || currentUser.role === 'admin' || currentUser.role === 'director') && (
                    <button
                      onClick={() => handleOpenConsumablesModal(session)}
                      className="w-full bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:border-yellow-500/40 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer mb-2"
                    >
                      <PlusCircle size={13} /> Ajouter Boisson/Snack
                    </button>
                  )}

                  {/* Cashier Credit Line */}
                  <div className="pt-2 border-t border-zinc-850 text-[10px] text-zinc-500 flex justify-between mt-auto">
                    <span>Opérateur: <strong className="text-zinc-400 capitalize">{session.createdByName}</strong></span>
                    <span>{new Date(session.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>

                {/* Card Actions Bottom */}
                <div className="p-4 bg-black/50 border-t border-zinc-800/30 flex justify-between gap-1.5 shrink-0">
                  {/* PDF Invoice Button */}
                  <button
                    onClick={() => setActiveInvoiceSession(session)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-stone-200 hover:text-white px-2.5 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    title="Facturer (PDF)"
                  >
                    <Printer size={14} /> Facture
                  </button>

                  {/* Validation payment button - only if pending */}
                  {session.paymentStatus === 'pending' ? (
                    <button
                      onClick={() => {
                        setValidatingSession(session);
                        setSelectedPaymentMethod('cash');
                      }}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black px-2.5 py-2 rounded text-xs font-black flex items-center justify-center gap-1 cursor-pointer transition-all"
                      title="Valider le paiement"
                    >
                      <CheckCircle size={14} /> Valider
                    </button>
                  ) : (
                    <div className="flex-1 text-center py-2 text-zinc-500 text-xs font-bold bg-zinc-900 border border-zinc-800/35 rounded select-none">
                      Payé / Validé ✓
                    </div>
                  )}

                  {/* Edit Invoice Button (Admin/Director) */}
                  {(currentUser.role === 'admin' || currentUser.role === 'director') && (
                    <button
                      onClick={() => setEditingSession(session)}
                      className="bg-yellow-500/10 hover:bg-yellow-500 hover:text-black text-yellow-500 px-3 py-2 rounded text-xs transition-colors cursor-pointer"
                      title="Modifier la facture / session"
                    >
                      <Edit size={14} />
                    </button>
                  )}

                  {/* Supprimer button */}
                  <button
                    onClick={() => onDeleteSession(session.id)}
                    className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 px-3 py-2 rounded text-xs transition-colors cursor-pointer"
                    title={currentUser.role === 'user' ? 'Créer une requête de suppression' : 'Supprimer'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

              </motion.div>
            );
          })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Invoice Modal Render */}
      {activeInvoiceSession && (
        <InvoicePrint 
          session={activeInvoiceSession} 
          cashierName={activeInvoiceSession.paymentStatus === 'paid' ? (activeInvoiceSession.paymentValidatedByName || currentUser.name) : currentUser.name}
          onClose={() => setActiveInvoiceSession(null)}
        />
      )}

      {/* Consumables Modal Render */}
      {consumablesModalSession && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] border border-zinc-800 rounded-xl max-w-sm w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-850 flex justify-between items-center bg-black/20">
              <h3 className="font-extrabold text-sm text-yellow-500 uppercase tracking-wider flex items-center gap-2">
                <Coffee size={16} />
                Ajouter Consommations
              </h3>
              <button 
                onClick={() => setConsumablesModalSession(null)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-zinc-400">Client : <strong className="text-white">{consumablesModalSession.clientName}</strong></p>
                <p className="text-xs text-zinc-400 mt-0.5">Console : <strong className="text-white uppercase">{consumablesModalSession.consoleType} (N° {consumablesModalSession.consoleNumber})</strong></p>
                <p className="text-xs text-zinc-500 mt-1">Déjà consommés : {consumablesModalSession.drinksCount || 0} boissons, {consumablesModalSession.snacksCount || 0} snacks</p>
              </div>

              {/* Drinks Selector */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-semibold flex items-center gap-1"><Coffee size={12} className="text-yellow-500" /> Boisson (+0.80$ / u)</span>
                  <span className="text-zinc-500 font-mono">Total : {addedDrinks >= 0 ? '+' : ''}${(addedDrinks * 0.8).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono px-1">
                  <span>En réserve : <strong className={currentDrinkStock <= 20 ? 'text-red-400' : 'text-emerald-400'}>{currentDrinkStock} canettes</strong></span>
                  <span>Nouveau stock : <strong>{Math.max(0, currentDrinkStock - addedDrinks)}</strong></span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddedDrinks(prev => {
                      if (currentUser.role === 'admin' || currentUser.role === 'director') {
                        const minAllowed = -(consumablesModalSession.drinksCount || 0);
                        return Math.max(minAllowed, prev - 1);
                      }
                      return Math.max(0, prev - 1);
                    })}
                    className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-black text-lg flex items-center justify-center cursor-pointer select-none"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-black border border-zinc-800 rounded-lg flex items-center justify-center font-bold text-sm">
                    {addedDrinks}
                  </div>
                  <button
                    onClick={() => setAddedDrinks(prev => {
                      if (currentDrinkStock - prev <= 0) {
                        alert("Attention: Le stock en réserve est épuisé !");
                      }
                      return prev + 1;
                    })}
                    className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-black text-lg flex items-center justify-center cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Snacks Selector */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-semibold flex items-center gap-1"><ShoppingBag size={12} className="text-yellow-500" /> Snack (+1.00$ / u)</span>
                  <span className="text-zinc-500 font-mono">Total : {addedSnacks >= 0 ? '+' : ''}${(addedSnacks * 1.0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono px-1">
                  <span>En réserve : <strong className={currentSnackStock <= 20 ? 'text-red-400' : 'text-emerald-400'}>{currentSnackStock} paquets</strong></span>
                  <span>Nouveau stock : <strong>{Math.max(0, currentSnackStock - addedSnacks)}</strong></span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddedSnacks(prev => {
                      if (currentUser.role === 'admin' || currentUser.role === 'director') {
                        const minAllowed = -(consumablesModalSession.snacksCount || 0);
                        return Math.max(minAllowed, prev - 1);
                      }
                      return Math.max(0, prev - 1);
                    })}
                    className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-black text-lg flex items-center justify-center cursor-pointer select-none"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-black border border-zinc-800 rounded-lg flex items-center justify-center font-bold text-sm">
                    {addedSnacks}
                  </div>
                  <button
                    onClick={() => setAddedSnacks(prev => {
                      if (currentSnackStock - prev <= 0) {
                        alert("Attention: Le stock en réserve est épuisé !");
                      }
                      return prev + 1;
                    })}
                    className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-black text-lg flex items-center justify-center cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Breakdown cost preview */}
              <div className="bg-yellow-500/5 border border-yellow-500/10 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total actuel :</span>
                  <span>${consumablesModalSession.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-yellow-500 font-bold">
                  <span>Supplément conso :</span>
                  <span>+${((addedDrinks * 0.8) + (addedSnacks * 1.0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-zinc-800/60 pt-1 font-extrabold text-sm">
                  <span>Nouveau Total :</span>
                  <span className="text-yellow-400">${(consumablesModalSession.totalAmount + (addedDrinks * 0.8) + (addedSnacks * 1.0)).toFixed(2)}</span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConsumablesModalSession(null)}
                  className="flex-1 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveConsumables}
                  disabled={isSavingConsumables || (addedDrinks === 0 && addedSnacks === 0)}
                  className="flex-1 py-2 bg-yellow-500 text-black hover:bg-yellow-400 disabled:bg-[#1c1c1c] disabled:text-zinc-650 rounded-lg text-xs font-black cursor-pointer flex items-center justify-center gap-1"
                >
                  {isSavingConsumables ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Payment Method Validation Modal */}
      {validatingSession && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] border border-zinc-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-850 flex justify-between items-center bg-black/20">
              <h3 className="font-extrabold text-sm text-yellow-500 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle size={16} />
                Validation du paiement
              </h3>
              <button 
                onClick={() => setValidatingSession(null)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs text-zinc-400">Client : <strong className="text-white">{validatingSession.clientName}</strong></p>
                <p className="text-xs text-zinc-400 mt-0.5">Console : <strong className="text-white uppercase">{validatingSession.consoleType} (N° {validatingSession.consoleNumber})</strong></p>
                <p className="text-xs text-zinc-400 mt-0.5">Matchs joués : <strong className="text-white">{validatingSession.matchesCount}</strong></p>
                {((validatingSession.drinksCount || 0) > 0 || (validatingSession.snacksCount || 0) > 0) && (
                  <p className="text-xs text-zinc-400 mt-0.5">Consommations : <strong className="text-white">{(validatingSession.drinksCount || 0)} boissons, {(validatingSession.snacksCount || 0)} snacks</strong></p>
                )}
                <div className="mt-3 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg flex justify-between items-center">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Montant total dû :</span>
                  <span className="text-xl font-mono font-black text-emerald-400">${validatingSession.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-wider block">
                  Choisir le mode de paiement :
                </label>
                
                <div className="grid grid-cols-1 gap-2">
                  {/* Cash Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('cash')}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                      selectedPaymentMethod === 'cash'
                        ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400 font-bold'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedPaymentMethod === 'cash' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-400'}`}>
                        <Coins size={20} />
                      </div>
                      <div>
                        <span className="text-sm font-bold block">Cash / Espèces</span>
                        <span className="text-[10px] text-zinc-500 block">Règlement en monnaie fiduciaire</span>
                      </div>
                    </div>
                    {selectedPaymentMethod === 'cash' && (
                      <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-black font-black text-xs">
                        ✓
                      </div>
                    )}
                  </button>

                  {/* Mobile Money Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('mobile_money')}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                      selectedPaymentMethod === 'mobile_money'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400 font-bold'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedPaymentMethod === 'mobile_money' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-400'}`}>
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <span className="text-sm font-bold block">Mobile Money</span>
                        <span className="text-[10px] text-zinc-500 block">M-Pesa, Airtel Money, Orange Money...</span>
                      </div>
                    </div>
                    {selectedPaymentMethod === 'mobile_money' && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white font-black text-xs">
                        ✓
                      </div>
                    )}
                  </button>

                  {/* Credit Card Option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('card')}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                      selectedPaymentMethod === 'card'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedPaymentMethod === 'card' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <span className="text-sm font-bold block">Carte Bancaire / Visa</span>
                        <span className="text-[10px] text-zinc-500 block">Paiement par carte de crédit/débit</span>
                      </div>
                    </div>
                    {selectedPaymentMethod === 'card' && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-black font-black text-xs">
                        ✓
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={() => setValidatingSession(null)}
                  className="flex-1 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white cursor-pointer font-bold"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    onValidatePayment(validatingSession.id, selectedPaymentMethod);
                    setValidatingSession(null);
                  }}
                  className="flex-1 py-2.5 bg-yellow-500 text-black hover:bg-yellow-400 rounded-lg text-xs font-black cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={14} /> Confirmer la validation
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal (Director & Admin only) */}
      {editingSession && (
        <EditInvoiceModal
          session={editingSession}
          currentUser={currentUser}
          onClose={() => setEditingSession(null)}
          onRefresh={onRefresh}
        />
      )}

    </div>
  );
}
