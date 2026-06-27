import React, { useState } from 'react';
import { User, GameRoom } from '../types';
import { UserPlus, Shield, UserCog, Lock, Unlock, KeyRound, Check, RefreshCw, Trash2, Building, Users } from 'lucide-react';

interface UserManagementProps {
  users: User[];
  currentUser: User;
  onCreateUser: (user: any) => void;
  onToggleLock: (id: string) => void;
  onChangePassword: (id: string, newPass: string) => void;
  isLoading: boolean;
  rooms: GameRoom[];
  onRefreshData: () => void;
}

export default function UserManagement({
  users,
  currentUser,
  onCreateUser,
  onToggleLock,
  onChangePassword,
  isLoading,
  rooms,
  onRefreshData
}: UserManagementProps) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');

  // Selected operator for password change modal
  const [selectedUserForPass, setSelectedUserForPass] = useState<User | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [showPassSuccess, setShowPassSuccess] = useState(false);

  // Game Rooms states
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Room assignments modal states
  const [selectedRoomForAssign, setSelectedRoomForAssign] = useState<GameRoom | null>(null);
  const [assignedAdminId, setAssignedAdminId] = useState<string | null>(null);
  const [assignedCashierIds, setAssignedCashierIds] = useState<string[]>([]);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);

  const [formError, setFormError] = useState('');
  const [roomFormError, setRoomFormError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const triggerSuccessAlert = (message: string) => {
    setActionSuccess(message);
    const timer = setTimeout(() => setActionSuccess(''), 4000);
    return () => clearTimeout(timer);
  };

  const triggerErrorAlert = (message: string) => {
    setActionError(message);
    const timer = setTimeout(() => setActionError(''), 4000);
    return () => clearTimeout(timer);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!username.trim() || !name.trim() || !password.trim()) {
      setFormError('Tous les champs sont requis.');
      return;
    }

    onCreateUser({
      username: username.trim(),
      name: name.trim(),
      password: password.trim(),
      role
    });

    // Reset fields on success
    setUsername('');
    setName('');
    setPassword('');
    setRole('user');
  };

  const handleChangePasswordClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPass || !newPasswordValue.trim()) return;

    onChangePassword(selectedUserForPass.id, newPasswordValue.trim());
    setNewPasswordValue('');
    setShowPassSuccess(true);
    setTimeout(() => {
      setShowPassSuccess(false);
      setSelectedUserForPass(null);
    }, 2000);
  };

  const handleDeleteUser = async (id: string, userName: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${userName}" définitivement ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${id}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });

      if (res.ok) {
        triggerSuccessAlert(`L'utilisateur ${userName} a été supprimé avec succès !`);
        onRefreshData();
      } else {
        const data = await res.json();
        triggerErrorAlert(data.error || "Impossible de supprimer l'utilisateur.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur réseau lors de la suppression.");
    }
  };

  const handleDeleteAllCreatedUsers = async () => {
    if (!window.confirm("Êtes-vous absolument sûr de vouloir supprimer TOUS les utilisateurs créés sous votre autorité ? Cette action supprimera tous les caissiers/collaborateurs créés (à l'exception du Directeur Général principal et de vous-même) !")) {
      return;
    }

    try {
      const res = await fetch('/api/users/delete-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });

      if (res.ok) {
        const data = await res.json();
        triggerSuccessAlert(`${data.deletedCount} utilisateurs ont été supprimés avec succès !`);
        onRefreshData();
      } else {
        const data = await res.json();
        triggerErrorAlert(data.error || "Erreur lors de la suppression collective.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur de connexion lors de la suppression collective.");
    }
  };

  // Create a game room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomFormError('');

    if (!newRoomName.trim()) {
      setRoomFormError('Le nom de la salle est obligatoire.');
      return;
    }

    setIsCreatingRoom(true);

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          name: newRoomName.trim(),
          description: newRoomDesc.trim()
        })
      });

      if (res.ok) {
        triggerSuccessAlert(`La salle de jeux "${newRoomName}" a été créée.`);
        setNewRoomName('');
        setNewRoomDesc('');
        onRefreshData();
      } else {
        const data = await res.json();
        setRoomFormError(data.error || 'Erreur lors de la création de la salle.');
      }
    } catch (err) {
      setRoomFormError('Erreur de réseau.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Open the assignments modal for a specific room
  const handleOpenAssignModal = (room: GameRoom) => {
    setSelectedRoomForAssign(room);
    setAssignedAdminId(room.adminId);
    setAssignedCashierIds(room.cashierIds || []);
  };

  // Save assignments
  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomForAssign) return;

    setIsSavingAssignments(true);

    try {
      const res = await fetch(`/api/rooms/${selectedRoomForAssign.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          adminId: assignedAdminId,
          cashierIds: assignedCashierIds
        })
      });

      if (res.ok) {
        triggerSuccessAlert('Les assignations de collaborateurs ont été mises à jour !');
        setSelectedRoomForAssign(null);
        onRefreshData();
      } else {
        const data = await res.json();
        triggerErrorAlert(data.error || "Erreur lors de la sauvegarde.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur réseau.");
    } finally {
      setIsSavingAssignments(false);
    }
  };

  // Delete game room
  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement la salle de jeux "${roomName}" ?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/rooms/${roomId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        }
      });

      if (res.ok) {
        triggerSuccessAlert(`La salle "${roomName}" a été supprimée.`);
        onRefreshData();
      } else {
        const data = await res.json();
        triggerErrorAlert(data.error || "Impossible de supprimer la salle.");
      }
    } catch (err) {
      triggerErrorAlert("Erreur réseau lors de la suppression de la salle.");
    }
  };

  const handleToggleCashierSelect = (cashierId: string) => {
    setAssignedCashierIds(prev => 
      prev.includes(cashierId) 
        ? prev.filter(id => id !== cashierId)
        : [...prev, cashierId]
    );
  };

  // Only Admin or Director can see/use this screen. Otherwise, display warning or fallback
  if (currentUser.role !== 'director' && currentUser.role !== 'admin') {
    return (
      <div className="bg-[#141414] border border-red-500/10 rounded-xl p-8 text-center text-zinc-400">
        <Shield size={36} className="mx-auto text-red-500 mb-2" />
        <h3 className="font-extrabold text-white">Création Bloquée / Action Exclusive</h3>
        <p className="text-xs mt-1">Seuls les directeurs ou administrateurs ont l'autorisation de gérer d'autres comptes.</p>
      </div>
    );
  }

  // Filter lists of potentials
  const adminsList = users.filter(u => u.role === 'admin' && u.id !== 'dir-1');
  const cashiersList = users.filter(u => u.role === 'user');
  const visibleUsers = users.filter(u => u.id !== currentUser.id);

  return (
    <div className="space-y-8 text-white min-h-screen pb-12" id="user-management-tab">
      
      {/* Header Row */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <UserCog size={24} className="text-yellow-500" />
          Contrôle des Opérateurs & Comptes (Points 5, 6, 12, 15)
        </h2>
        <p className="text-zinc-500 text-xs text-left mt-1">
          Gérez vos collaborateurs, créez de nouveaux comptes, ou distribuez les accès entre vos différentes salles de jeux indépendantes.
        </p>
      </div>

      {/* Status Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-bold flex items-center gap-2">
          <Check size={16} /> {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-bold flex items-center gap-2 block">
          <Shield size={16} className="text-red-500 shrink-0" /> {actionError}
        </div>
      )}

      {/* SECTION 1: USER MANAGEMENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Create User Form */}
        <div className="bg-[#141414] border border-zinc-800 rounded-xl p-5 h-fit space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            <UserPlus size={16} className="text-yellow-500" />
            Créer un Utilisateur
          </h3>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            
            {formError && (
              <p className="p-2.5 bg-red-500/15 border border-red-500/30 rounded text-xs text-red-500 font-semibold">{formError}</p>
            )}

            {/* Role Select - Admin / User */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Catégorie de compte</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('user')}
                  className={`py-2 rounded font-black text-xs transition-colors cursor-pointer ${
                    role === 'user' 
                      ? 'bg-yellow-500 text-black' 
                      : 'bg-black/40 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  Caissier (Simple)
                </button>
                {currentUser.role === 'director' && (
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`py-2 rounded font-black text-xs transition-colors cursor-pointer ${
                      role === 'admin' 
                        ? 'bg-yellow-500 text-black' 
                        : 'bg-black/40 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                  >
                    Administrateur
                  </button>
                )}
              </div>
            </div>

            {/* Pseudo Identifiant */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase block">Identifiant</label>
              <input
                type="text"
                placeholder="Ex : NovaKaissier02"
                className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-yellow-500"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>

            {/* Nom Complet */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase block">Nom de l'agent caissier</label>
              <input
                type="text"
                placeholder="Ex : Hervé Kayembe"
                className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-yellow-500"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            {/* Mot de passe par défaut */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase block">Mot de passe temporaire</label>
              <input
                type="password"
                placeholder="Ex : Muller2@_temp"
                className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-yellow-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black py-2.5 rounded font-black text-xs tracking-wider uppercase cursor-pointer transition-colors"
            >
              {isLoading ? 'Création...' : 'Créer le Compte'}
            </button>

          </form>
        </div>

        {/* Right Column - User List & Controls */}
        <div className="bg-[#141414] border border-zinc-800 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <Users size={16} className="text-yellow-500" />
              Collaborateurs Enregistrés ({visibleUsers.length})
            </h3>
            
            {visibleUsers.length > 0 && (currentUser.role === 'director' || currentUser.role === 'admin') && (
              <button
                onClick={handleDeleteAllCreatedUsers}
                className="bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-500 hover:text-white transition-all px-3 py-2 text-[10px] uppercase font-black tracking-wider flex items-center gap-1.5 rounded-lg cursor-pointer animate-pulse"
                title="Supprimer définitivement tous les comptes créés"
              >
                <Trash2 size={12} /> SUPPRIMER TOUS LES EXPLOITANTS
              </button>
            )}
          </div>

          {visibleUsers.length === 0 ? (
            <div className="text-center text-zinc-600 p-8 text-xs font-semibold">
              Aucun autre compte utilisateur enregistré sous votre autorité.
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {visibleUsers.map(user => {
                const canDelete = currentUser.role === 'director' || (currentUser.role === 'admin' && user.createdBy === currentUser.id);

                return (
                  <div key={user.id} className="p-3.5 bg-zinc-900/40 rounded-xl border border-zinc-800/60 flex items-center justify-between gap-4">
                    <div className="flex gap-3 items-center">
                      <div className="w-9 h-9 rounded-full bg-zinc-800 border border-[#facc15]/20 text-yellow-500 font-extrabold flex items-center justify-center text-sm uppercase select-none">
                        {user.username.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-xs text-white leading-tight capitalize">{user.name}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            user.role === 'admin' ? 'bg-[#facc15]/10 text-[#facc15]' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {user.role === 'admin' ? 'Admis' : 'Caissier'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Identifiant: <span className="font-mono text-zinc-300 font-bold">{user.username}</span></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedUserForPass(user)}
                        className="p-2 bg-zinc-800/80 hover:bg-zinc-750 text-yellow-500 hover:text-white rounded-lg transition-colors cursor-pointer text-xs"
                        title="Changer mot de passe"
                      >
                        <KeyRound size={12} />
                      </button>

                      <button
                        onClick={() => onToggleLock(user.id)}
                        className={`p-2 rounded-lg transition-colors cursor-pointer text-xs ${
                          user.isLocked 
                            ? 'bg-red-500/10 text-red-500 border border-red-500/25 hover:bg-red-500/20' 
                            : 'bg-zinc-800/80 hover:bg-zinc-750 hover:text-white text-zinc-400'
                        }`}
                        title={user.isLocked ? "Déverrouiller" : "Verrouiller"}
                      >
                        {user.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>

                      {canDelete && user.id !== 'dir-1' && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg border border-red-500/10 hover:border-red-500 transition-colors cursor-pointer"
                          title="Supprimer définitivement"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: GAME ROOMS & ASSIGNMENTS */}
      <div className="border-t border-zinc-800 pt-8" id="rooms-management-section">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Building size={18} className="text-yellow-500" />
            Gestion des Salles de Jeux & Assignations de Personnel
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Chaque salle possède un gestionnaire administrateur unique et plusieurs caissiers autorisés à lancer les sessions de jeu.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Create Room Form (Directors only) */}
          {currentUser.role === 'director' && (
            <div className="bg-[#141414] border border-zinc-800 rounded-xl p-5 h-fit space-y-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Nouvelle salle de jeux
              </h4>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                {roomFormError && (
                  <p className="p-2.5 bg-red-500/15 border border-red-500/30 rounded text-xs text-red-500 font-semibold">{roomFormError}</p>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase block">Nom de la salle</label>
                  <input
                    type="text"
                    placeholder="Ex : VIP Zone / Salle Kasa-Vubu"
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-yellow-500"
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase block">Description / Notes</label>
                  <textarea
                    placeholder="Ex : Équipée de 4 consoles PS5 haut de gamme"
                    rows={2}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-yellow-500 resize-none"
                    value={newRoomDesc}
                    onChange={e => setNewRoomDesc(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingRoom}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black py-2 rounded font-black text-xs tracking-wider uppercase cursor-pointer transition-colors"
                >
                  {isCreatingRoom ? 'Création...' : 'Créer la Salle de Jeux'}
                </button>
              </form>
            </div>
          )}

          {/* Rooms List */}
          <div className={`bg-[#141414] border border-zinc-800 rounded-xl p-5 h-fit space-y-4 ${currentUser.role === 'director' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Salles de jeux configurées ({rooms.length})
            </h4>

            {rooms.length === 0 ? (
              <div className="text-center text-zinc-650 p-8 text-xs">
                Aucune salle de jeux configurée. {currentUser.role === 'director' && "Créez-en une à gauche."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map(room => {
                  // Find Admin name
                  const adminUser = users.find(u => u.id === room.adminId);
                  // Count cashiers
                  const cashiersCount = room.cashierIds ? room.cashierIds.length : 0;
                  const isDefaultRoom = room.id === "room-default";

                  return (
                    <div key={room.id} className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h5 className="font-extrabold text-sm text-[#facc15]">{room.name}</h5>
                            {room.description && (
                              <p className="text-[11px] text-zinc-400 mt-1">{room.description}</p>
                            )}
                          </div>
                          {!isDefaultRoom && currentUser.role === 'director' && (
                            <button
                              onClick={() => handleDeleteRoom(room.id, room.name)}
                              className="text-zinc-500 hover:text-red-500 transition-colors p-1 cursor-pointer"
                              title="Supprimer la salle de jeux"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        {/* Assignments Overview */}
                        <div className="mt-3 space-y-1.5 border-t border-zinc-800/60 pt-3">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-zinc-500">1 Administrateur :</span>
                            <span className={adminUser ? "text-zinc-200 capitalize" : "text-yellow-500/60 font-medium"}>
                              {adminUser ? adminUser.name : "Aucun assigné"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-zinc-500">Caissiers assignés :</span>
                            <span className="text-zinc-200">{cashiersCount}</span>
                          </div>
                        </div>
                      </div>

                      {currentUser.role === 'director' && (
                        <button
                          onClick={() => handleOpenAssignModal(room)}
                          className="w-full bg-zinc-850 hover:bg-[#facc15] hover:text-black hover:font-extrabold text-zinc-300 font-bold py-1.5 rounded text-xs transition-colors cursor-pointer border border-[#facc15]/15"
                        >
                          Modifier les collaborateurs
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Dynamic Assignments Modal */}
      {selectedRoomForAssign && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveAssignments} className="bg-[#141414] border border-[#facc15]/30 w-full max-w-md rounded-xl p-6 space-y-4 animate-fade-in shadow-2xl relative">
            
            <h4 className="font-black text-sm text-[#facc15] flex items-center gap-2">
              <Building size={18} />
              Assignation de personnel : {selectedRoomForAssign.name}
            </h4>
            <p className="text-xs text-zinc-400">
              Configurez le personnel affecté à cette salle de jeux pour isoler la gestion financière et des consoles.
            </p>

            {/* Part A: Single Admin assignment */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#facc15] font-black uppercase tracking-wider block">
                Assigner un Chef Administrateur (Optionnel, Max 1)
              </label>
              <select
                value={assignedAdminId || ''}
                onChange={e => setAssignedAdminId(e.target.value || null)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded p-2.5 outline-none focus:border-yellow-500"
              >
                <option value="">-- Aucun administrateur gérant --</option>
                {adminsList.map(item => (
                  <option key={item.id} value={item.id}>
                    👤 {item.name} ({item.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Part B: Multiple Cashiers assignment */}
            <div className="space-y-2">
              <label className="text-[10px] text-[#facc15] font-black uppercase tracking-wider block">
                Assigner plusieurs Caissiers / Opérateurs (Co-gestionnaires)
              </label>
              
              {cashiersList.length === 0 ? (
                <p className="text-[11px] text-zinc-650 italic">Aucun caissier enregistré dans le terminal pour l'instant.</p>
              ) : (
                <div className="bg-zinc-950 border border-zinc-900 rounded p-3 space-y-2.5 max-h-[160px] overflow-y-auto">
                  {cashiersList.map(cashier => {
                    const isChecked = assignedCashierIds.includes(cashier.id);
                    return (
                      <label key={cashier.id} className="flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCashierSelect(cashier.id)}
                          className="rounded text-yellow-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="capitalize">{cashier.name}</span>
                        <span className="text-[9px] text-zinc-600 font-mono">({cashier.username})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer triggers */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedRoomForAssign(null)}
                className="flex-1 bg-zinc-850 hover:bg-zinc-800 py-2 rounded font-bold text-xs px-3 text-white transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSavingAssignments}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-extrabold py-2 rounded text-xs px-3 transition-colors cursor-pointer"
              >
                {isSavingAssignments ? 'Sauvegarde...' : 'Affecter'}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Password change Modal */}
      {selectedUserForPass && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] border border-yellow-500/30 w-full max-w-sm rounded-xl p-5 space-y-4">
            <h4 className="font-black text-sm text-yellow-500 flex items-center gap-1.5">
              <KeyRound size={16} />
              Modifier le mot de passe
            </h4>
            <p className="text-xs text-zinc-400">
              Forcé le changement de mot de passe à distance de : <strong className="text-zinc-200">{selectedUserForPass.name}</strong>.
            </p>

            {showPassSuccess ? (
              <div className="p-3 bg-emerald-500/15 text-emerald-500 rounded text-center text-xs font-bold flex items-center justify-center gap-1.5">
                <Check size={16} /> Mot de passe mis à jour !
              </div>
            ) : (
              <form onSubmit={handleChangePasswordClick} className="space-y-4">
                <input
                  type="password"
                  placeholder="Entrez le nouveau mot de passe"
                  className="w-full bg-[#0a0a0a] border border-zinc-800 rounded px-3 py-2.5 text-xs text-white focus:border-yellow-500 outline-none"
                  value={newPasswordValue}
                  onChange={e => setNewPasswordValue(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUserForPass(null)}
                    className="flex-1 bg-zinc-800 py-2 rounded text-xs px-3 text-white transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-extrabold py-2 rounded text-xs px-3 transition-colors cursor-pointer"
                  >
                    Confirmer
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
