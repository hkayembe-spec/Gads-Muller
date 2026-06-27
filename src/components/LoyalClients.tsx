import React, { useState, useMemo } from 'react';
import { User, ClientSession, LoyalClient } from '../types';
import { 
  Heart, 
  Search, 
  UserPlus, 
  Phone, 
  FileText, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  ChevronRight, 
  Calendar, 
  Coins, 
  Gamepad2,
  CalendarDays
} from 'lucide-react';

interface LoyalClientsProps {
  loyalClients: LoyalClient[];
  sessions: ClientSession[];
  currentUser: User;
  onRefresh: () => void;
  triggerSuccess: (text: string) => void;
  triggerError: (text: string) => void;
}

export default function LoyalClients({ 
  loyalClients, 
  sessions, 
  currentUser, 
  onRefresh, 
  triggerSuccess, 
  triggerError 
}: LoyalClientsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals / forms state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<LoyalClient | null>(null);
  
  // Add client form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit client form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Calculate statistics for a customer based on game sessions
  const clientStatsMap = useMemo(() => {
    const map: Record<string, { sessionsCount: number, matchesCount: number, totalSpent: number, lastActive: string }> = {};
    
    // Group all sessions by clientName (case-insensitive)
    sessions.forEach(sess => {
      const nameKey = sess.clientName.trim().toLowerCase();
      if (!map[nameKey]) {
        map[nameKey] = {
          sessionsCount: 0,
          matchesCount: 0,
          totalSpent: 0,
          lastActive: ''
        };
      }
      
      map[nameKey].sessionsCount += 1;
      map[nameKey].matchesCount += sess.matchesCount;
      if (sess.paymentStatus === 'paid') {
        map[nameKey].totalSpent += sess.totalAmount;
      }
      
      // Keep track of newest date
      if (!map[nameKey].lastActive || new Date(sess.createdAt).getTime() > new Date(map[nameKey].lastActive).getTime()) {
        map[nameKey].lastActive = sess.createdAt;
      }
    });
    
    return map;
  }, [sessions]);

  // Filter clients
  const filteredClients = useMemo(() => {
    return loyalClients.filter(c => {
      const matchName = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPhone = c.phone.toLowerCase().includes(searchTerm.toLowerCase());
      const matchNotes = c.notes?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      return matchName || matchPhone || matchNotes;
    });
  }, [loyalClients, searchTerm]);

  // Handle Add Submit
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      triggerError("Le nom complet du client est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/loyal-clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          name: newName,
          phone: newPhone,
          notes: newNotes
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerSuccess(`Client fidèle ${newName} créé avec succès !`);
        setNewName('');
        setNewPhone('');
        setNewNotes('');
        setIsAddOpen(false);
        onRefresh();
      } else {
        triggerError(data.error || "Impossible d'enregistrer le client fidèle.");
      }
    } catch (err) {
      triggerError("Erreur réseau.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Submit
  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    if (!editName.trim()) {
      triggerError("Le nom complet est obligatoire.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/loyal-clients/${editingClient.id}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          notes: editNotes
        })
      });

      const data = await res.json();
      if (res.ok) {
        triggerSuccess("Informations du client mises à jour.");
        setEditingClient(null);
        onRefresh();
      } else {
        triggerError(data.error || "Impossible de mettre à jour le client.");
      }
    } catch (err) {
      triggerError("Erreur réseau.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Click
  const handleDeleteClient = async (id: string, name: string) => {
    if (currentUser.role !== 'director' && currentUser.role !== 'admin') {
      triggerError("Action non autorisée. Seuls les administrateurs peuvent supprimer un client fidèle.");
      return;
    }

    if (!window.confirm(`Êtes-vous sûr de vouloir retirer "${name}" de la liste des clients fidèles ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/loyal-clients/${id}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });

      if (res.ok) {
        triggerSuccess(`Client ${name} retiré avec succès de la liste.`);
        onRefresh();
      } else {
        const data = await res.json();
        triggerError(data.error || "Erreur lors du retrait du client.");
      }
    } catch (err) {
      triggerError("Erreur lors de la communication de suppression.");
    }
  };

  // Open Edit Dialog
  const startEdit = (client: LoyalClient) => {
    setEditingClient(client);
    setEditName(client.name);
    setEditPhone(client.phone || '');
    setEditNotes(client.notes || '');
  };

  const isAtLeastAdmin = currentUser.role === 'director' || currentUser.role === 'admin';

  return (
    <div className="space-y-6 text-white" id="loyal-clients-section">
      
      {/* Tab Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="text-yellow-500 fill-yellow-500/20" size={24} />
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">Membres & Clients Fidèles</h1>
          </div>
          <p className="text-xs text-zinc-400">Gérez la base des clients réguliers, suivez leurs préférences, statistiques de fidélité et dépenses.</p>
        </div>
        
        <button
          onClick={() => setIsAddOpen(true)}
          className="bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-black font-extrabold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-yellow-500/10 cursor-pointer transition-all self-start sm:self-center"
        >
          <UserPlus size={16} /> Enregistrer un Membre
        </button>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#121212] border border-zinc-805/40 p-5 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/15">
            <Heart size={22} className="fill-yellow-500/10" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Membres Fidèles Enregistrés</p>
            <h3 className="text-2xl font-black text-white mt-1">{loyalClients.length}</h3>
          </div>
        </div>

        <div className="bg-[#121212] border border-zinc-805/40 p-5 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/15">
            <Coins size={22} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Cumul d'Achats Membres</p>
            <h3 className="text-2xl font-black text-green-400 mt-1">
              ${(Object.values(clientStatsMap).reduce((acc: number, current: any) => acc + current.totalSpent, 0) as number).toFixed(2)}
            </h3>
          </div>
        </div>

        <div className="bg-[#121212] border border-zinc-805/40 p-5 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/15">
            <Gamepad2 size={22} />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Matchs des Abonnés</p>
            <h3 className="text-2xl font-black text-cyan-400 mt-1">
              {Object.values(clientStatsMap).reduce((acc: number, current: any) => acc + current.matchesCount, 0)} matchs
            </h3>
          </div>
        </div>
      </div>

      {/* Main Filter and Table Box */}
      <div className="bg-[#121212] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800 bg-[#161616] flex flex-col md:flex-row items-center gap-4 justify-between">
          
          {/* Search Input Bar */}
          <div className="relative w-full md:w-96">
            <span className="absolute left-3.5 top-3 text-zinc-500"><Search size={16} /></span>
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone, notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2 pl-10 pr-4 text-xs text-white placeholder-zinc-500 outline-none transition-all font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-2.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="text-xs text-zinc-400 font-medium">
            Affichage de <span className="text-yellow-500 font-bold">{filteredClients.length}</span> sur <span className="text-white font-bold">{loyalClients.length}</span> membres
          </div>
        </div>

        {/* Clients Table */}
        <div className="overflow-x-auto">
          {filteredClients.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase font-bold tracking-wider bg-[#0f0f0f]">
                  <th className="py-4 px-5">Nom complet / Téléphone</th>
                  <th className="py-4 px-4 text-center">Sessions</th>
                  <th className="py-4 px-4 text-center">Matchs Joués</th>
                  <th className="py-4 px-4 text-right">Dépenses Cumulées</th>
                  <th className="py-4 px-5">Notes / Préférences</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {filteredClients.map(client => {
                  const sKey = client.name.trim().toLowerCase();
                  const stats = clientStatsMap[sKey] || { sessionsCount: 0, matchesCount: 0, totalSpent: 0, lastActive: '' };
                  
                  return (
                    <tr key={client.id} className="hover:bg-zinc-800/20 transition-colors group">
                      <td className="py-4 px-5">
                        <div className="font-bold text-white text-sm tracking-tight">{client.name}</div>
                        <div className="text-zinc-500 font-semibold mt-1 flex items-center gap-1">
                          <Phone size={11} className="text-yellow-500" />
                          {client.phone ? client.phone : <span className="italic text-zinc-650">Aucun numéro</span>}
                        </div>
                      </td>
                      
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-black ${stats.sessionsCount > 0 ? 'bg-zinc-800 text-white' : 'text-zinc-650'}`}>
                          {stats.sessionsCount}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center font-mono font-bold text-zinc-300">
                        {stats.matchesCount}
                      </td>

                      <td className="py-4 px-4 text-right font-black text-sm text-green-400 font-mono">
                        ${stats.totalSpent.toFixed(2)}
                      </td>

                      <td className="py-4 px-5 max-w-xs">
                        <p className="text-zinc-400 line-clamp-2 italic font-medium">{client.notes || <span className="text-zinc-650">Aucune note.</span>}</p>
                        {stats.lastActive && (
                          <span className="text-[10px] text-zinc-600 block mt-1 font-semibold flex items-center gap-1">
                            <CalendarDays size={10} />
                            Actif le : {new Date(stats.lastActive).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex justify-end gap-2.5 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(client)}
                            title="Modifier les détails"
                            className="p-2 bg-zinc-800 hover:bg-zinc-700 hover:text-yellow-500 text-zinc-400 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 size={14} />
                          </button>
                          
                          {isAtLeastAdmin && (
                            <button
                              onClick={() => handleDeleteClient(client.id, client.name)}
                              title="Retirer de la base de données"
                              className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-zinc-500 space-y-3">
              <div className="w-16 h-16 bg-zinc-900/60 rounded-full flex items-center justify-center mx-auto text-zinc-600 border border-zinc-800/50">
                <Heart size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-400">Aucun client trouvé</p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">Essaie une autre recherche ou crée un nouveau client membre pour commencer le suivi.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL - REGISTER NEW CLIENT */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden" id="add-loyal-client-modal">
            
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-yellow-500"></div>

            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart size={18} className="text-yellow-500 fill-yellow-500/20" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">Nouveau Membre Fidèle</h3>
              </div>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddClient}>
              <div className="p-6 space-y-4">
                
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Nom Complet</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex. Christian Mutombo"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2.5 px-3.5 text-xs text-white placeholder-zinc-600 outline-none transition-all font-medium"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Numéro de Téléphone</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-zinc-500"><Phone size={13} /></span>
                    <input
                      type="text"
                      placeholder="Ex. +243 999 123 456"
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2.5 pl-9 pr-3.5 text-xs text-white placeholder-zinc-650 outline-none transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Notes / Préférences (Optionnel)</label>
                  <textarea
                    placeholder="Ex. Joueur régulier PS5, vient souvent le weekend, préfère FIFA..."
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2.5 px-3.5 text-xs text-white placeholder-zinc-650 outline-none transition-all font-medium resize-none"
                  />
                </div>

              </div>

              <div className="p-4 bg-[#0a0a0a] border-t border-zinc-820 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-extrabold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {isSubmitting ? 'Enregistrement...' : <>Créer le Membre <Check size={14} /></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - EDIT CLIENT DETAILS */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden" id="edit-loyal-client-modal">
            
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-yellow-500"></div>

            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-yellow-500" />
                <h3 className="text-base font-black text-white uppercase tracking-tight">Modifier les informations</h3>
              </div>
              <button 
                onClick={() => setEditingClient(null)}
                className="text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleEditClient}>
              <div className="p-6 space-y-4">
                
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Nom Complet</label>
                  <input
                    type="text"
                    required
                    placeholder="Christian Mutombo"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2.5 px-3.5 text-xs text-white placeholder-zinc-600 outline-none transition-all font-medium"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Numéro de Téléphone</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-zinc-500"><Phone size={13} /></span>
                    <input
                      type="text"
                      placeholder="+243 ..."
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2.5 pl-9 pr-3.5 text-xs text-white placeholder-zinc-650 outline-none transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Notes / Préférences</label>
                  <textarea
                    placeholder="Entrez vos remarques sur les préférences du client..."
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2.5 px-3.5 text-xs text-white placeholder-zinc-650 outline-none transition-all font-medium resize-none"
                  />
                </div>

              </div>

              <div className="p-4 bg-[#0a0a0a] border-t border-zinc-820 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-extrabold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {isSubmitting ? 'Enregistrement...' : <>Enregistrer les modifications <Check size={14} /></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
