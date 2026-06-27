import React, { useState, useEffect } from 'react';
import { Gamepad2, UserPlus, Phone, Hash, ChevronRight, Coins } from 'lucide-react';
import { PlayStationConsole, ClientSession, ConsoleType, LoyalClient } from '../types';

interface NewClientProps {
  loyalClients: LoyalClient[];
  consoles: PlayStationConsole[];
  sessions: ClientSession[];
  onSubmit: (client: {
    clientName: string;
    consoleNumber: string;
    phoneNumber: string;
    consoleType: ConsoleType;
    matchesCount: number;
    saveAsLoyal?: boolean;
    drinksCount?: number;
    snacksCount?: number;
  }) => void;
  isLoading: boolean;
  onSuccess: () => void;
}

export default function NewClient({ loyalClients, consoles, sessions, onSubmit, isLoading, onSuccess }: NewClientProps) {
  const [selectedLoyalId, setSelectedLoyalId] = useState('');
  const [clientName, setClientName] = useState('');
  const [consoleNumber, setConsoleNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consoleType, setConsoleType] = useState<ConsoleType>('ps5');
  const [matchesCount, setMatchesCount] = useState<number>(5);
  const [drinksCount, setDrinksCount] = useState<number>(0);
  const [snacksCount, setSnacksCount] = useState<number>(0);
  const [saveAsLoyal, setSaveAsLoyal] = useState(false);
  const [errorMess, setErrorMess] = useState('');

  // Auto calculate pricing rules
  const pricing = {
    ps5: 0.50,
    ps4: 0.25,
    ps3: 0.10
  };

  const costPerMatch = pricing[consoleType];
  const totalCost = parseFloat(((matchesCount * costPerMatch) + (drinksCount * 0.8) + (snacksCount * 1.0)).toFixed(2));

  const getConsoleBusyState = (cName: string) => {
    return sessions.some(s => s.paymentStatus === 'pending' && s.consoleNumber.toLowerCase() === cName.toLowerCase());
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess('');

    if (!clientName.trim()) {
      setErrorMess('Le nom complet du client est requis.');
      return;
    }
    if (!consoleNumber.trim()) {
      setErrorMess('Le numéro de la console est requis.');
      return;
    }
    if (getConsoleBusyState(consoleNumber)) {
      setErrorMess(`La console "${consoleNumber}" est déjà occupée par une session en cours.`);
      return;
    }
    if (isNaN(matchesCount) || matchesCount <= 0) {
      setErrorMess('Veuillez entrer un nombre de matchs valide supérieur à 0.');
      return;
    }

    onSubmit({
      clientName,
      consoleNumber,
      phoneNumber,
      consoleType,
      matchesCount,
      saveAsLoyal,
      drinksCount,
      snacksCount
    });

    // Reset fields
    setSelectedLoyalId('');
    setClientName('');
    setConsoleNumber('');
    setPhoneNumber('');
    setMatchesCount(5);
    setDrinksCount(0);
    setSnacksCount(0);
    setSaveAsLoyal(false);
  };

  return (
    <div className="max-w-xl mx-auto text-white space-y-6" id="new-client-tab">
      
      <div className="flex items-center gap-2 mb-2">
        <UserPlus size={24} className="text-yellow-500" />
        <h2 className="text-xl font-bold tracking-tight text-white">Enregistrer un Nouveau Client</h2>
      </div>

      <div className="bg-[#141414] border border-zinc-800 rounded-xl p-6 shadow-xl">
        <form onSubmit={handleFormSubmit} className="space-y-5">
          
          {errorMess && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-500 text-xs font-semibold">
              {errorMess}
            </div>
          )}

          {/* Rechercher/Sélectionner un client fidèle enregistré */}
          {loyalClients && loyalClients.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs text-yellow-500 font-semibold uppercase tracking-wider block">Sélectionner un Client Existant (Fidèle)</label>
              <select
                value={selectedLoyalId}
                onChange={e => {
                  const id = e.target.value;
                  setSelectedLoyalId(id);
                  if (id) {
                    const lc = loyalClients.find(c => c.id === id);
                    if (lc) {
                      setClientName(lc.name);
                      setPhoneNumber(lc.phone || '');
                      setSaveAsLoyal(false); // already saved!
                    }
                  } else {
                    setClientName('');
                    setPhoneNumber('');
                  }
                }}
                className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-3 px-4 text-sm text-white outline-none transition-all font-medium cursor-pointer"
              >
                <option value="" className="text-zinc-650">-- Client occasionnel / Nouveau client (Saisie manuelle) --</option>
                {loyalClients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Client Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Nom Complet</label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-zinc-500"><UserPlus size={18} /></span>
              <input
                type="text"
                placeholder="Ex. Jean Kabange"
                className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-650 outline-none transition-all font-medium"
                value={clientName}
                onChange={e => {
                  setClientName(e.target.value);
                  if (selectedLoyalId) setSelectedLoyalId('');
                }}
              />
            </div>
            
            {/* Save as loyal member checkbox if manually inputting new client name */}
            {!selectedLoyalId && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="saveAsLoyalCheckbox"
                  checked={saveAsLoyal}
                  onChange={e => setSaveAsLoyal(e.target.checked)}
                  className="w-4 h-4 rounded text-yellow-500 bg-[#0a0a0a] border-zinc-800 focus:ring-yellow-500/20 cursor-pointer accent-yellow-500"
                />
                <label htmlFor="saveAsLoyalCheckbox" className="text-xs text-zinc-400 font-medium select-none cursor-pointer">
                  Mémoriser ce client dans la base de données des clients fidèles
                </label>
              </div>
            )}
          </div>

          {/* Row for Console and Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Console Number */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Numéro de la Console</label>
              {consoles && consoles.length > 0 ? (
                <div className="relative">
                  <select
                    value={consoleNumber}
                    onChange={e => {
                      const selectedName = e.target.value;
                      setConsoleNumber(selectedName);
                      // Match type
                      const found = consoles.find(c => c.name === selectedName);
                      if (found) {
                        setConsoleType(found.type);
                      }
                    }}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-[13px] px-4 text-sm text-white outline-none transition-all font-medium cursor-pointer"
                  >
                    <option value="" className="text-zinc-600">-- Choisir une console --</option>
                    {consoles.map(c => {
                      const isBusy = getConsoleBusyState(c.name);
                      const isMaint = c.status === 'maintenance';
                      const labelText = `${c.name} (${c.type.toUpperCase()}) ${isMaint ? '⚠️ En maintenance' : isBusy ? '🔴 Occupée' : '🟢 Libre'}`;
                      return (
                        <option key={c.id} value={c.name} disabled={isMaint || isBusy}>
                          {labelText}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-zinc-500"><Hash size={18} /></span>
                  <input
                    type="text"
                    placeholder="Ex. Console 03"
                    className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-650 outline-none transition-all font-medium"
                    value={consoleNumber}
                    onChange={e => setConsoleNumber(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Téléphone (Optionnel)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-zinc-500"><Phone size={18} /></span>
                <input
                  type="text"
                  placeholder="Ex. +243 890 000 000"
                  className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-650 outline-none transition-all font-medium"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Console Choice Type (PS3, PS4, PS5) */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Choix de la Console</label>
            <div className="grid grid-cols-3 gap-3">
              {(['ps5', 'ps4', 'ps3'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setConsoleType(type)}
                  className={`py-3.5 rounded-lg border-2 text-sm font-black flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    consoleType === type 
                      ? 'bg-yellow-500 border-yellow-500 text-black' 
                      : 'bg-[#0a0a0a] border-zinc-800 hover:border-yellow-500/40 text-white'
                  }`}
                >
                  <Gamepad2 size={18} />
                  <span className="uppercase">{type}</span>
                  <span className={`text-[10px] font-mono ${consoleType === type ? 'text-black/80' : 'text-zinc-500'}`}>
                    ${pricing[type]}/match
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Number of Matches to Play */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Nombre de Matchs à Jouer</label>
            <div className="flex gap-2">
              <button
                type="button"
                className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg font-black text-xl flex items-center justify-center transition-colors cursor-pointer"
                onClick={() => setMatchesCount(prev => Math.max(1, prev - 1))}
              >
                -
              </button>
              <input
                type="number"
                className="flex-1 bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-3 text-center text-lg font-bold text-white outline-none"
                value={matchesCount}
                onChange={e => setMatchesCount(parseInt(e.target.value) || 0)}
                min="1"
              />
              <button
                type="button"
                className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg font-black text-xl flex items-center justify-center transition-colors cursor-pointer"
                onClick={() => setMatchesCount(prev => prev + 1)}
              >
                +
              </button>
            </div>
          </div>

          {/* Consommables (Boissons & Snacks) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Boissons */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Boissons (Canettes, Jus)</label>
                <span className="text-[10px] text-yellow-500 font-bold">$0.80 / unité</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg font-black text-lg flex items-center justify-center transition-colors cursor-pointer select-none"
                  onClick={() => setDrinksCount(prev => Math.max(0, prev - 1))}
                >
                  -
                </button>
                <input
                  type="number"
                  className="flex-1 bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2 text-center text-base font-bold text-white outline-none"
                  value={drinksCount}
                  onChange={e => setDrinksCount(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                />
                <button
                  type="button"
                  className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg font-black text-lg flex items-center justify-center transition-colors cursor-pointer select-none"
                  onClick={() => setDrinksCount(prev => prev + 1)}
                >
                  +
                </button>
              </div>
            </div>

            {/* Snacks */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Snacks & Biscuits</label>
                <span className="text-[10px] text-yellow-500 font-bold">$1.00 / unité</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg font-black text-lg flex items-center justify-center transition-colors cursor-pointer select-none"
                  onClick={() => setSnacksCount(prev => Math.max(0, prev - 1))}
                >
                  -
                </button>
                <input
                  type="number"
                  className="flex-1 bg-[#0a0a0a] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2 text-center text-base font-bold text-white outline-none"
                  value={snacksCount}
                  onChange={e => setSnacksCount(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                />
                <button
                  type="button"
                  className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg font-black text-lg flex items-center justify-center transition-colors cursor-pointer select-none"
                  onClick={() => setSnacksCount(prev => prev + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Receipt Calculation Overlay */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-zinc-400">Total estimé à payer</p>
              <div className="flex flex-col gap-0.5 mt-1 text-green-400 font-bold text-xs">
                <div className="flex items-center gap-1">
                  <Coins size={14} />
                  <span>Matchs: {matchesCount} × ${costPerMatch} = ${(matchesCount * costPerMatch).toFixed(2)}</span>
                </div>
                {(drinksCount > 0 || snacksCount > 0) && (
                  <span className="text-zinc-400 font-normal text-[11px] pl-5">
                    Consommation: {drinksCount} Boisson(s) (${(drinksCount * 0.8).toFixed(2)}) + {snacksCount} Snack(s) (${(snacksCount * 1).toFixed(2)})
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-yellow-500">${totalCost.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-black font-extrabold py-3.5 rounded-lg text-sm transition-all focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? 'Enregistrement...' : "Créer le Client & Encaisser"} <ChevronRight size={16} />
          </button>

        </form>
      </div>
    </div>
  );
}
