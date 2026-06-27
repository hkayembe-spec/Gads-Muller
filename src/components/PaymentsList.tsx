import React, { useState } from 'react';
import { ClientSession } from '../types';
import { Coins, Printer, Search, ArrowUpRight, Award, Trash2, Calendar, Smartphone, CreditCard } from 'lucide-react';
import InvoicePrint from './InvoicePrint';

interface PaymentsListProps {
  sessions: ClientSession[];
  onDeleteSession: (id: string) => void;
  currentUser: any;
}

export default function PaymentsList({ sessions, onDeleteSession, currentUser }: PaymentsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeInvoice, setActiveInvoice] = useState<ClientSession | null>(null);

  // Filter only paid/validated sessions
  const paidSessions = sessions.filter(s => s.paymentStatus === 'paid');

  const filteredPayments = paidSessions.filter(p => {
    return p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           p.consoleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
           p.consoleType.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const grandTotal = filteredPayments.reduce((acc, p) => acc + p.totalAmount, 0);

  return (
    <div className="space-y-6 text-white" id="payments-tab">
      
      {/* Header and top banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Coins size={24} className="text-emerald-500" />
            Paiements Validés ({paidSessions.length})
          </h2>
          <p className="text-zinc-500 text-xs">Historique des transactions validées et encaissées.</p>
        </div>

        {/* Aggregate revenue strip */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-emerald-500 flex items-center justify-center text-black font-black">
            $
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest leading-none">TOTAL ENCAISSÉ FILTRÉ</p>
            <p className="text-xl font-black text-emerald-400 mt-1">${grandTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Filter Options Block */}
      <div className="relative">
        <span className="absolute left-3.5 top-3.5 text-zinc-500"><Search size={18} /></span>
        <input
          type="text"
          placeholder="Filtrer par nom de client, numéro de console..."
          className="w-full bg-[#141414] border border-zinc-800 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 rounded-lg py-2.5 pl-11 pr-4 text-sm text-white placeholder-zinc-600 outline-none"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredPayments.length === 0 ? (
        <div className="bg-[#141414] border border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
          <p className="font-semibold text-zinc-400">Aucune transaction payée enregistrée</p>
          <p className="text-xs mt-1">Les paiements validés s'afficheront ici avec leurs reçus d'impression.</p>
        </div>
      ) : (
        <div className="bg-[#141414] border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#0f0f0f] border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="p-4 font-semibold">Client</th>
                  <th className="p-4 font-semibold">Console</th>
                  <th className="p-4 font-semibold text-center">Matchs</th>
                  <th className="p-4 font-semibold text-right">Montant</th>
                  <th className="p-4 font-semibold text-center">Mode</th>
                  <th className="p-4 font-semibold text-center">Date Validation</th>
                  <th className="p-4 font-semibold">Validateur</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredPayments.map(payment => (
                  <tr key={payment.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-yellow-500">{payment.clientName}</div>
                      {payment.phoneNumber && (
                        <div className="text-zinc-500 text-xs mt-0.5">{payment.phoneNumber}</div>
                      )}
                    </td>
                    <td className="p-4 font-mono font-medium">
                      <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs select-none mr-2">
                        {payment.consoleType.toUpperCase()}
                      </span>
                      Console N°{payment.consoleNumber}
                    </td>
                    <td className="p-4 text-center font-bold">{payment.matchesCount}</td>
                    <td className="p-4 text-right font-black text-emerald-400">${payment.totalAmount.toFixed(2)}</td>
                    <td className="p-4 text-center">
                      {payment.paymentMethod === 'mobile_money' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400">
                          <Smartphone size={12} /> Mobile Money
                        </span>
                      ) : payment.paymentMethod === 'card' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <CreditCard size={12} /> Carte de crédit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                          <Coins size={12} /> Cash / Espèces
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center text-xs text-zinc-400">
                      {new Date(payment.updatedAt).toLocaleDateString('fr-FR')} à {new Date(payment.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-4 text-xs font-semibold text-zinc-300 capitalize">
                      {payment.paymentValidatedByName || 'Administrateur'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setActiveInvoice(payment)}
                          className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-yellow-500 hover:text-white rounded text-xs tracking-wider font-extrabold cursor-pointer transition-colors"
                          title="Réimprimer reçu"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteSession(payment.id)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded cursor-pointer transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
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
