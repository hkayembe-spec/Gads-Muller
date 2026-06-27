import React, { useState, useEffect } from 'react';
import { ClientSession, User } from '../types';
import { X, Check, Save, User as UserIcon, Phone, Gamepad2, Coffee, ShoppingBag, CreditCard, Coins, Smartphone, AlertTriangle } from 'lucide-react';

interface EditInvoiceModalProps {
  session: ClientSession;
  currentUser: User;
  onClose: () => void;
  onRefresh: () => void;
}

export default function EditInvoiceModal({
  session,
  currentUser,
  onClose,
  onRefresh
}: EditInvoiceModalProps) {
  const [clientName, setClientName] = useState(session.clientName);
  const [phoneNumber, setPhoneNumber] = useState(session.phoneNumber || '');
  const [consoleNumber, setConsoleNumber] = useState(session.consoleNumber);
  const [consoleType, setConsoleType] = useState<'ps3' | 'ps4' | 'ps5'>(session.consoleType as any || 'ps4');
  const [matchesCount, setMatchesCount] = useState(session.matchesCount);
  const [drinksCount, setDrinksCount] = useState(session.drinksCount || 0);
  const [snacksCount, setSnacksCount] = useState(session.snacksCount || 0);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>(session.paymentStatus as any || 'pending');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card'>(session.paymentMethod as any || 'cash');
  
  // Custom total amount override or automatic
  const [isManualAmount, setIsManualAmount] = useState(false);
  const [manualAmount, setManualAmount] = useState(session.totalAmount.toString());
  
  const [errorMess, setErrorMess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Auto calculate total
  const getCalculatedTotal = () => {
    let costPerMatch = 0.25;
    if (consoleType === 'ps5') costPerMatch = 0.50;
    else if (consoleType === 'ps4') costPerMatch = 0.25;
    else if (consoleType === 'ps3') costPerMatch = 0.10;

    const matchesCost = matchesCount * costPerMatch;
    const drinksCost = drinksCount * 0.8;
    const snacksCost = snacksCount * 1.0;
    return parseFloat((matchesCost + drinksCost + snacksCost).toFixed(2));
  };

  const calculatedTotal = getCalculatedTotal();

  const handleSave = async () => {
    if (!clientName.trim()) {
      setErrorMess("Le nom du client est obligatoire.");
      return;
    }
    if (!consoleNumber.trim()) {
      setErrorMess("Le numéro de la console est obligatoire.");
      return;
    }
    if (matchesCount < 0) {
      setErrorMess("Le nombre de matchs ne peut pas être négatif.");
      return;
    }

    setIsSaving(true);
    setErrorMess('');

    try {
      const finalAmount = isManualAmount ? parseFloat(manualAmount) || 0 : calculatedTotal;

      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const localDate = `${year}-${month}-${day}`;

      const res = await fetch(`/api/sessions/${session.id}/update-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          clientName: clientName.trim(),
          phoneNumber: phoneNumber.trim(),
          consoleNumber: consoleNumber.trim(),
          consoleType,
          matchesCount,
          drinksCount,
          snacksCount,
          paymentStatus,
          paymentMethod,
          totalAmount: finalAmount,
          localDate
        })
      });

      if (res.ok) {
        onRefresh();
        onClose();
      } else {
        const errData = await res.json();
        setErrorMess(errData.error || "Erreur lors de la mise à jour de la facture.");
      }
    } catch (err) {
      console.error(err);
      setErrorMess("Erreur de connexion.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-[#141414] border border-zinc-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white my-8">
        
        {/* Header */}
        <div className="p-4 border-b border-zinc-850 flex justify-between items-center bg-black/20">
          <div>
            <h3 className="font-extrabold text-sm text-yellow-500 uppercase tracking-wider flex items-center gap-2">
              <Gamepad2 size={16} />
              Modifier Facture (Session N° {session.id.substring(0, 8)})
            </h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">Modifier les détails de la facture, les consommations, et le mode de paiement.</p>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMess && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{errorMess}</span>
            </div>
          )}

          {/* Client Details Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider border-b border-zinc-900 pb-1">Détails Client</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <UserIcon size={10} /> Nom du Client
                </label>
                <input
                  type="text"
                  className="w-full bg-[#0d0d0d] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-700 outline-none transition-all"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Phone size={10} /> Téléphone
                </label>
                <input
                  type="text"
                  className="w-full bg-[#0d0d0d] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-700 outline-none transition-all"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="08xxxxxxxx"
                />
              </div>
            </div>
          </div>

          {/* Console Details Section */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider border-b border-zinc-900 pb-1">Détails de la Console</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Numéro de Console</label>
                <input
                  type="text"
                  className="w-full bg-[#0d0d0d] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-700 outline-none transition-all uppercase"
                  value={consoleNumber}
                  onChange={e => setConsoleNumber(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Type de Console</label>
                <select
                  className="w-full bg-[#0d0d0d] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded px-2.5 py-1.5 text-xs text-white outline-none transition-all cursor-pointer"
                  value={consoleType}
                  onChange={e => setConsoleType(e.target.value as any)}
                >
                  <option value="ps5">PS5 ($0.50 / match)</option>
                  <option value="ps4">PS4 ($0.25 / match)</option>
                  <option value="ps3">PS3 ($0.10 / match)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Matchs Joués</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMatchesCount(prev => Math.max(1, prev - 1))}
                    className="px-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-bold select-none cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="w-full bg-[#0d0d0d] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded px-1.5 py-1.5 text-xs text-white text-center outline-none transition-all font-mono"
                    value={matchesCount}
                    onChange={e => setMatchesCount(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <button
                    type="button"
                    onClick={() => setMatchesCount(prev => prev + 1)}
                    className="px-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-bold select-none cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Items & Consumables Section */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider border-b border-zinc-900 pb-1">Consommations de la Facture</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Drinks */}
              <div className="bg-[#0c0c0c] p-3 rounded-lg border border-zinc-900 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                    <Coffee size={13} className="text-yellow-500" />
                    Boissons ($0.80)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Total: ${(drinksCount * 0.8).toFixed(2)}$</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDrinksCount(prev => Math.max(0, prev - 1))}
                    className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded font-black text-sm flex items-center justify-center cursor-pointer select-none"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-[#141414] border border-zinc-800 rounded flex items-center justify-center font-mono font-bold text-xs">
                    {drinksCount}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrinksCount(prev => prev + 1)}
                    className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded font-black text-sm flex items-center justify-center cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Snacks */}
              <div className="bg-[#0c0c0c] p-3 rounded-lg border border-zinc-900 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                    <ShoppingBag size={13} className="text-yellow-500" />
                    Snacks ($1.00)
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">Total: ${(snacksCount * 1.0).toFixed(2)}$</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSnacksCount(prev => Math.max(0, prev - 1))}
                    className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded font-black text-sm flex items-center justify-center cursor-pointer select-none"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-[#141414] border border-zinc-800 rounded flex items-center justify-center font-mono font-bold text-xs">
                    {snacksCount}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSnacksCount(prev => prev + 1)}
                    className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded font-black text-sm flex items-center justify-center cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Validation & Payment Settings */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider border-b border-zinc-900 pb-1">Statut & Encaissement</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Statut du Paiement</label>
                <select
                  className="w-full bg-[#0d0d0d] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded px-2.5 py-1.5 text-xs text-white outline-none transition-all cursor-pointer"
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value as any)}
                >
                  <option value="pending">En Attente (Non validé)</option>
                  <option value="paid">Validé &amp; Payé</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Mode d'encaissement</label>
                <select
                  className="w-full bg-[#0d0d0d] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded px-2.5 py-1.5 text-xs text-white outline-none transition-all cursor-pointer"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  disabled={paymentStatus !== 'paid'}
                >
                  <option value="cash">Espèces (Cash)</option>
                  <option value="mobile_money">Mobile Money (M-Pesa/Orange)</option>
                  <option value="card">Carte Bancaire / VISA</option>
                </select>
              </div>
            </div>
          </div>

          {/* Total Amount & Manual Override */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider border-b border-zinc-900 pb-1">Règlement Financier (Montant Payé)</h4>
            
            <div className="bg-[#0b0b0b] p-4 rounded-lg border border-zinc-900 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chk-manual"
                  className="rounded bg-black border-zinc-800 text-yellow-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  checked={isManualAmount}
                  onChange={e => {
                    setIsManualAmount(e.target.checked);
                    if (e.target.checked) {
                      setManualAmount(calculatedTotal.toString());
                    }
                  }}
                />
                <label htmlFor="chk-manual" className="text-xs font-semibold text-zinc-300 cursor-pointer select-none">
                  Forcer manuellement le montant payé (Surcharge)
                </label>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-zinc-900">
                <span className="text-xs text-zinc-400">Total calculé automatiquement:</span>
                <span className="text-sm font-mono font-bold text-zinc-300">${calculatedTotal.toFixed(2)}</span>
              </div>

              {isManualAmount ? (
                <div className="space-y-1 pt-1 animate-in slide-in-from-top-1 duration-150">
                  <label className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">Nouveau Montant Surchargé ($)</label>
                  <input
                    type="text"
                    className="w-full bg-[#141414] border border-yellow-500/50 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded px-3 py-2 text-sm text-yellow-400 font-mono outline-none transition-all"
                    value={manualAmount}
                    onChange={e => setManualAmount(e.target.value)}
                  />
                  <p className="text-[9px] text-zinc-500">Note: Entrez le montant total exact perçu. Ce montant sera enregistré dans les rapports financiers.</p>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-zinc-900/40 px-3 py-2 rounded border border-zinc-850">
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Montant Final Net :</span>
                  <span className="text-base font-mono font-black text-emerald-400">${calculatedTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-zinc-850 flex gap-3 bg-black/20">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white cursor-pointer font-bold transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 bg-yellow-500 text-black hover:bg-yellow-400 disabled:bg-[#1c1c1c] disabled:text-zinc-650 rounded-lg text-xs font-black cursor-pointer flex items-center justify-center gap-1.5 transition-all"
          >
            {isSaving ? (
              <span>Sauvegarde...</span>
            ) : (
              <>
                <Save size={14} />
                <span>Enregistrer la modification</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
