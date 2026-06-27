import React, { useState, useMemo } from 'react';
import { FinanceTransaction, ClientSession, User } from '../types';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PlusCircle, 
  Trash2, 
  Calendar, 
  DollarSign, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  PieChart, 
  Plus, 
  X,
  Info,
  Printer,
  Coffee,
  Cookie
} from 'lucide-react';

interface FinanceProps {
  transactions: FinanceTransaction[];
  sessions: ClientSession[];
  currentUser: User;
  onAddTransaction: (transaction: Partial<FinanceTransaction>) => Promise<any>;
  onDeleteTransaction: (id: string) => Promise<any>;
  isLoading: boolean;
}

const getLocalDateString = (isoStringOrDate?: string | Date | null) => {
  const d = isoStringOrDate 
    ? (typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate)
    : new Date();
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Finance({ 
  transactions, 
  sessions, 
  currentUser, 
  onAddTransaction, 
  onDeleteTransaction, 
  isLoading 
}: FinanceProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Quick sales and printable states
  const [quickDrinks, setQuickDrinks] = useState(0);
  const [quickSnacks, setQuickSnacks] = useState(0);
  const [isPrintModeOpen, setIsPrintModeOpen] = useState(false);

  // New transaction form state
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState('Vente boissons');
  const [customCategory, setCustomCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => getLocalDateString());
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const predefinedCategories = {
    income: ["Vente boissons", "Vente snacks", "Abonnement VIP", "Services supplémentaires", "Autre Entrée"],
    expense: ["Achat matériel", "Réparation console", "Achat Boissons/Snacks", "Facture Électricité", "Loyer local", "Salaires", "Autre Dépense"]
  };

  // Autocomplete/preset categories for dropdown
  const categoriesList = type === 'income' ? predefinedCategories.income : predefinedCategories.expense;

  // Sync category state when type changes
  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    setCategory(newType === 'income' ? predefinedCategories.income[0] : predefinedCategories.expense[0]);
  };

  // Dynamic automatic entries from paid sessions
  const paidSessionsAsIncomes = useMemo(() => {
    // Collect all session IDs from transactions to prevent duplicates
    const representedSessionIds = new Set(
      transactions
        .filter(t => t.id && (t.id.startsWith('fin-sess-') || t.id.startsWith('sess-')))
        .map(t => t.id.replace('fin-sess-', '').replace('sess-', ''))
    );

    return sessions
      .filter(s => s.paymentStatus === 'paid' && !representedSessionIds.has(s.id))
      .map(s => ({
        id: `fin-sess-${s.id}`,
        type: 'income' as const,
        category: 'Session PlayStation',
        amount: s.totalAmount,
        description: `Session validée pour le client ${s.clientName} (Console: ${s.consoleNumber})`,
        date: getLocalDateString(s.updatedAt || s.createdAt),
        createdBy: s.createdBy,
        createdByName: s.createdByName || 'Caissier',
        createdAt: s.createdAt,
        isAutomatic: true // flags that this is computed automatically
      }));
  }, [sessions, transactions]);

  // Combine custom user transactions with auto-generated session incomes
  const combinedTransactions = useMemo(() => {
    const customList = transactions.map(t => ({ ...t, isAutomatic: false }));
    const all = [...customList, ...paidSessionsAsIncomes];
    // Sort by date descending, then by createdAt descending
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, paidSessionsAsIncomes]);

  // Total summary aggregates
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    combinedTransactions.forEach(t => {
      if (t.type === 'income') {
        income += t.amount;
      } else {
        expense += t.amount;
      }
    });

    return {
      income,
      expense,
      net: income - expense
    };
  }, [combinedTransactions]);

  // Filtered list
  const filteredTransactions = useMemo(() => {
    return combinedTransactions.filter(t => {
      const matchType = filterType === 'all' ? true : t.type === filterType;
      const matchCategory = filterCategory === 'all' ? true : t.category === filterCategory;
      return matchType && matchCategory;
    });
  }, [combinedTransactions, filterType, filterCategory]);

  // Get list of all unique categories in combined transactions for filters
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    combinedTransactions.forEach(t => cats.add(t.category));
    return Array.from(cats);
  }, [combinedTransactions]);

  const handleOpenModal = () => {
    setType('income');
    setCategory(predefinedCategories.income[0]);
    setCustomCategory('');
    setAmount('');
    setDescription('');
    setDate(getLocalDateString());
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = category === 'Autre Entrée' || category === 'Autre Dépense' 
      ? (customCategory.trim() || category)
      : category;

    if (!finalCategory) {
      setErrorMsg("La catégorie est obligatoire.");
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg("Le montant doit être un nombre positif supérieur à 0.");
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      await onAddTransaction({
        type,
        category: finalCategory,
        amount: numAmount,
        description: description.trim(),
        date
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, description: string, amount: number) => {
    if (window.confirm(`Voulez-vous supprimer cette transaction financière de "${description || 'Flux'}" d'un montant de ${amount}$ ?`)) {
      try {
        await onDeleteTransaction(id);
      } catch (err) {
        alert("Erreur lors de la suppression du flux financier.");
      }
    }
  };

  const handleQuickSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickDrinks === 0 && quickSnacks === 0) return;
    setIsSaving(true);
    try {
      if (quickDrinks > 0) {
        await onAddTransaction({
          type: 'income',
          category: 'Vente boissons',
          amount: Number((quickDrinks * 0.8).toFixed(2)),
          description: `Vente Express : ${quickDrinks} Boisson(s) à 0.80$`,
          date: getLocalDateString()
        });
      }
      if (quickSnacks > 0) {
        await onAddTransaction({
          type: 'income',
          category: 'Vente snacks',
          amount: Number((quickSnacks * 1.0).toFixed(2)),
          description: `Vente Express : ${quickSnacks} Snack(s) à 1.00$`,
          date: getLocalDateString()
        });
      }
      setQuickDrinks(0);
      setQuickSnacks(0);
    } catch (err) {
      alert("Erreur lors de l'enregistrement de la vente rapide.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-white" id="finance-tab">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <Wallet className="text-[#facc15] h-7 w-7" />
            Gestion Financière Nova Casino
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Supervision des entrées d'argent (automatiques par sessions & manuelles) et enregistrement des dépenses opérationnelles.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsPrintModeOpen(true)}
            className="bg-zinc-900 text-zinc-300 border border-zinc-800 px-4 py-2.5 rounded-lg text-xs font-black transition-all hover:text-white hover:bg-zinc-800 cursor-pointer flex items-center gap-2 shadow-lg"
          >
            <Printer size={15} />
            Rapport à Imprimer (PDF)
          </button>

          <button
            onClick={handleOpenModal}
            className="bg-[#facc15] text-black px-4 py-2.5 rounded-lg text-xs font-black transition-all hover:bg-yellow-400 cursor-pointer flex items-center gap-2 shadow-lg shadow-yellow-500/10"
          >
            <PlusCircle size={15} />
            Nouveau Flux Financier
          </button>
        </div>
      </div>

      {/* Financial Stats Summary (Entrees, Depenses, Net Profit) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Entrées */}
        <div className="bg-[#141414] border border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Entrées (Revenus Totaux)</span>
            <span className="text-2xl font-black text-emerald-400">{totals.income.toFixed(2)}$</span>
            <span className="text-[9px] text-zinc-500 block">Sessions payées inclues</span>
          </div>
          <div className="p-3.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Dépenses */}
        <div className="bg-[#141414] border border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Dépenses (Opérationnelles)</span>
            <span className="text-2xl font-black text-red-400">{totals.expense.toFixed(2)}$</span>
            <span className="text-[9px] text-zinc-500 block">Achats, factures et salaires</span>
          </div>
          <div className="p-3.5 rounded-lg bg-red-500/10 text-red-500 shrink-0">
            <TrendingDown size={24} />
          </div>
        </div>

        {/* Revenus Nets */}
        <div className={`bg-[#141414] border rounded-xl p-5 flex items-center justify-between shadow-xl ${
          totals.net >= 0 ? 'border-emerald-500/25' : 'border-red-500/25'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Bénéfice Net (Revenus)</span>
            <span className={`text-2xl font-black ${totals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totals.net >= 0 ? '+' : ''}{totals.net.toFixed(2)}$
            </span>
            <span className="text-[9px] text-zinc-500 block">Différence brute encaissée</span>
          </div>
          <div className={`p-3.5 rounded-lg shrink-0 ${
            totals.net >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'
          }`}>
            <PieChart size={24} />
          </div>
        </div>
      </div>

      {/* Caisse Express / Vente Rapide Section */}
      <div className="bg-gradient-to-r from-zinc-900/95 to-[#141414] border border-zinc-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-yellow-500/10 text-[#facc15]">
              <Coffee size={16} />
            </span>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Caisse Express / Vente de Consommations</h3>
              <p className="text-[10px] text-zinc-500">Enregistrez instantanément les ventes de boissons fraîches à 0.80$ et de snacks à 1.00$</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black block">Total Sélectionné</span>
            <span className="text-sm font-black text-[#facc15] font-mono">
              {((quickDrinks * 0.8) + (quickSnacks * 1.0)).toFixed(2)}$
            </span>
          </div>
        </div>

        <form onSubmit={handleQuickSale} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {/* Boisson Select counter */}
          <div className="bg-black/30 border border-zinc-800/80 p-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400">
                <Coffee size={15} />
              </div>
              <div>
                <span className="text-xs font-extrabold text-zinc-200 block">Boissons fraîches</span>
                <span className="text-[9px] font-mono text-zinc-500">0.80$ / canette</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuickDrinks(prev => Math.max(0, prev - 1))}
                className="w-7 h-7 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-md flex items-center justify-center transition-all cursor-pointer active:scale-95 text-xs font-black"
              >
                -
              </button>
              <span className="w-5 text-center font-black text-xs text-white">{quickDrinks}</span>
              <button
                type="button"
                onClick={() => setQuickDrinks(prev => prev + 1)}
                className="w-7 h-7 bg-[#facc15] text-black hover:bg-yellow-400 rounded-md flex items-center justify-center transition-all font-black cursor-pointer active:scale-95 text-xs"
              >
                +
              </button>
            </div>
          </div>

          {/* Snack Select counter */}
          <div className="bg-black/30 border border-zinc-800/80 p-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                <Cookie size={15} />
              </div>
              <div>
                <span className="text-xs font-extrabold text-zinc-200 block">Snacks croquants</span>
                <span className="text-[9px] font-mono text-zinc-500">1.00$ / sachet</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuickSnacks(prev => Math.max(0, prev - 1))}
                className="w-7 h-7 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-md flex items-center justify-center transition-all cursor-pointer active:scale-95 text-xs font-black"
              >
                -
              </button>
              <span className="w-5 text-center font-black text-xs text-white">{quickSnacks}</span>
              <button
                type="button"
                onClick={() => setQuickSnacks(prev => prev + 1)}
                className="w-7 h-7 bg-[#facc15] text-black hover:bg-yellow-400 rounded-md flex items-center justify-center transition-all font-black cursor-pointer active:scale-95 text-xs"
              >
                +
              </button>
            </div>
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={isSaving || (quickDrinks === 0 && quickSnacks === 0)}
            className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border border-transparent disabled:pointer-events-none text-black font-black text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/5"
          >
            <PlusCircle size={14} />
            Valider la Vente ({(quickDrinks * 0.8 + quickSnacks * 1.0).toFixed(2)}$)
          </button>
        </form>
      </div>

      {/* Filters and Controls */}
      <div className="bg-[#141414] border border-zinc-800/80 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-xl">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Type Filter */}
          <div className="flex bg-black/40 border border-zinc-800 rounded-lg p-0.5 shrink-0">
            {(['all', 'income', 'expense'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  filterType === t 
                    ? 'bg-yellow-500 text-black' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t === 'all' ? 'Tous' : t === 'income' ? 'Entrées' : 'Dépenses'}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="relative w-full sm:w-44">
            <Filter size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 bg-black/40 border border-zinc-800 focus:border-yellow-500 rounded-lg text-[11px] text-zinc-300 outline-none cursor-pointer"
            >
              <option value="all">Toutes Catégories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-[10px] text-zinc-500 font-mono self-end sm:self-center">
          Affichage de {filteredTransactions.length} flux financier(s)
        </div>
      </div>

      {/* Transactions list */}
      {isLoading ? (
        <div className="text-center py-12 bg-[#141414] border border-zinc-800 rounded-xl text-zinc-400 animate-pulse text-xs font-black">
          Chargement du registre comptable...
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-16 bg-[#141414] border border-dashed border-zinc-800 rounded-xl space-y-3">
          <Wallet size={36} className="text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400 font-bold">Aucune transaction enregistrée.</p>
          <button 
            onClick={handleOpenModal} 
            className="text-xs font-black text-yellow-500 hover:underline cursor-pointer"
          >
            Créer le premier mouvement financier
          </button>
        </div>
      ) : (
        <div className="bg-[#141414] border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/30 border-b border-zinc-800 text-[9px] uppercase font-black tracking-widest text-zinc-500">
                  <th className="p-4">Type</th>
                  <th className="p-4">Catégorie</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Opérateur</th>
                  <th className="p-4 text-right">Montant</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-xs">
                {filteredTransactions.map(trans => {
                  const isAuto = trans.isAutomatic;
                  
                  return (
                    <tr 
                      key={trans.id} 
                      className={`hover:bg-zinc-900/25 transition-colors ${
                        isAuto ? 'bg-emerald-500/[0.01]' : ''
                      }`}
                    >
                      {/* Type column */}
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          trans.type === 'income' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {trans.type === 'income' ? (
                            <>
                              <ArrowUpRight size={10} />
                              Entrée
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft size={10} />
                              Dépense
                            </>
                          )}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="p-4 font-black text-stone-200">
                        <div className="flex items-center gap-1.5">
                          <span>{trans.category}</span>
                          {isAuto && (
                            <span className="bg-[#facc15]/10 text-[#facc15] text-[8px] font-extrabold px-1.5 rounded border border-[#facc15]/20 select-none">
                              AUTO
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="p-4 max-w-xs truncate text-zinc-400" title={trans.description}>
                        {trans.description}
                      </td>

                      {/* Date */}
                      <td className="p-4 text-zinc-500 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} />
                          <span>{trans.date}</span>
                        </div>
                      </td>

                      {/* Operator */}
                      <td className="p-4 text-zinc-400 font-bold">
                        {trans.createdByName}
                      </td>

                      {/* Amount */}
                      <td className={`p-4 font-black text-right text-sm whitespace-nowrap ${
                        trans.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {trans.type === 'income' ? '+' : '-'}{trans.amount.toFixed(2)}$
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {isAuto ? (
                          <span className="text-[10px] text-zinc-600 font-mono">Verrouillé</span>
                        ) : (
                          currentUser.role === 'director' || currentUser.role === 'admin' ? (
                            <button
                              onClick={() => handleDelete(trans.id, trans.description, trans.amount)}
                              className="text-zinc-500 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-500/10 cursor-pointer"
                              title="Supprimer la transaction"
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-mono">Aucun droit</span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Note info section */}
      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 flex gap-3">
        <Info size={16} className="text-yellow-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-black text-yellow-500">Automatisation Comptable</p>
          <p className="text-[11px] text-zinc-400 leading-normal">
            Afin de garantir une transparence totale, chaque fois qu'un caissier valide un encaissement de session sur PlayStation, le bénéfice correspondant est instantanément enregistré et cumulé dans la section <span className="text-yellow-400 font-black">Entrées</span> de ce tableau de bord financier.
          </p>
        </div>
      </div>

      {/* Transaction Modal Box */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] border border-zinc-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-black/20">
              <h3 className="font-extrabold text-sm text-yellow-500 uppercase tracking-wider flex items-center gap-2">
                <Wallet size={16} />
                Enregistrer un flux financier
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="p-4 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400 font-bold">
                  {errorMsg}
                </div>
              )}

              {/* Toggle switch for Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 block">Type de Flux</label>
                <div className="grid grid-cols-2 gap-2 bg-black border border-zinc-800 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('income')}
                    className={`py-2 rounded-md text-xs font-black transition-all cursor-pointer ${
                      type === 'income' 
                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/15' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Entrée (Revenu)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('expense')}
                    className={`py-2 rounded-md text-xs font-black transition-all cursor-pointer ${
                      type === 'expense' 
                        ? 'bg-red-500 text-black shadow-lg shadow-red-500/15' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Dépense (Coût)
                  </button>
                </div>
              </div>

              {/* Predefined Categories */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 block">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-white focus:border-yellow-500 outline-none transition-colors cursor-pointer"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Custom Category Input if selected Autre */}
              {(category === 'Autre Entrée' || category === 'Autre Dépense') && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 block">Préciser la Catégorie</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Vente Canettes de jus"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-white focus:border-yellow-500 outline-none transition-colors"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 block">Montant ($ USD)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="Ex: 25.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-white focus:border-yellow-500 outline-none transition-colors"
                  />
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 block">Date de valeur</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-white focus:border-yellow-500 outline-none transition-colors cursor-pointer"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 block">Description / Notes</label>
                <textarea
                  placeholder="Ex: Achat de 2 nouvelles manettes PS5 noires pour la console 3"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-white focus:border-yellow-500 outline-none transition-colors resize-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-zinc-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#facc15] text-black hover:bg-yellow-400 rounded-lg text-xs font-black cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving ? "Enregistrement..." : "Enregistrer le flux"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Financial Report Modal Overlay */}
      {isPrintModeOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto no-print animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-4xl w-full my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header Controls (Not Printed) */}
            <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-[#facc15]">
                <Printer size={18} />
                <span className="text-xs font-black uppercase tracking-wider">Aperçu avant Impression du Rapport</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-500 text-black px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 hover:bg-emerald-400 cursor-pointer shadow-lg active:scale-95 transition-all"
                >
                  <Printer size={14} />
                  Lancer l'Impression / PDF
                </button>
                <button
                  onClick={() => setIsPrintModeOpen(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-xs font-black cursor-pointer flex items-center gap-1.5"
                >
                  <X size={15} />
                  Fermer
                </button>
              </div>
            </div>

            {/* Print Mode CSS styles */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-report-area, #printable-report-area * {
                  visibility: visible !important;
                }
                #printable-report-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  color: #000000 !important;
                  background: #ffffff !important;
                  padding: 20px !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}} />

            {/* Scrollable Printable Area */}
            <div className="p-8 bg-white text-black overflow-y-auto flex-1 font-sans" id="printable-report-area">
              
              {/* Report Header */}
              <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-5">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-900">Nova Casino</h1>
                  <p className="text-xs text-zinc-600 font-bold uppercase tracking-wider">Complexe de Jeux & Divertissement PlayStation</p>
                  <p className="text-[10px] text-zinc-500 mt-1">Généré le {new Date().toLocaleString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <div className="border border-zinc-900 px-3 py-1.5 rounded bg-zinc-50 inline-block">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black block">Statut du Rapport</span>
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">Clôturé & Prêt</span>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="my-6">
                <h2 className="text-lg font-black uppercase text-zinc-800 tracking-wide border-b border-zinc-300 pb-1">
                  Rapport de Gestion Financière
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-xs">
                  <div>
                    <span className="text-zinc-500 font-medium block">Période :</span>
                    <span className="font-bold text-zinc-900">Toutes les transactions</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-medium block">Éditeur :</span>
                    <span className="font-bold text-zinc-900">{currentUser.name} ({currentUser.role})</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-medium block">Type de monnaie :</span>
                    <span className="font-bold text-zinc-900">Dollars Américains ($ USD)</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-medium block">Mode d'impression :</span>
                    <span className="font-bold text-zinc-900">Format Standard A4 / PDF</span>
                  </div>
                </div>
              </div>

              {/* Financial Balance Summary Widgets */}
              <div className="grid grid-cols-3 gap-4 my-6 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                <div className="text-center border-r border-zinc-200">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block">Total des Entrées</span>
                  <span className="text-lg font-black text-emerald-600 font-mono">+{totals.income.toFixed(2)}$</span>
                </div>
                <div className="text-center border-r border-zinc-200">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block">Total des Sorties</span>
                  <span className="text-lg font-black text-red-600 font-mono">-{totals.expense.toFixed(2)}$</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold block">Solde Final (Bénéfice)</span>
                  <span className={`text-lg font-black font-mono ${totals.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {totals.net >= 0 ? '+' : ''}{totals.net.toFixed(2)}$
                  </span>
                </div>
              </div>

              {/* Detailed Transactions List */}
              <div className="mt-6">
                <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider mb-2.5">
                  Registre des Entrées et Sorties de Caisse
                </h3>
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b-2 border-zinc-900 bg-zinc-100 font-bold text-zinc-700">
                      <th className="p-2">Date</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Catégorie</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Opérateur</th>
                      <th className="p-2 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-800">
                    {combinedTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-zinc-50">
                        <td className="p-2 font-mono text-zinc-600 whitespace-nowrap">{t.date}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className={`font-bold uppercase text-[9px] ${
                            t.type === 'income' ? 'text-emerald-700' : 'text-red-700'
                          }`}>
                            {t.type === 'income' ? 'Entrée' : 'Dépense'}
                          </span>
                        </td>
                        <td className="p-2 font-bold text-zinc-900 whitespace-nowrap">{t.category}</td>
                        <td className="p-2 max-w-xs truncate text-zinc-600" title={t.description}>{t.description}</td>
                        <td className="p-2 font-medium text-zinc-700">{t.createdByName || 'Inconnu'}</td>
                        <td className={`p-2 font-bold text-right whitespace-nowrap font-mono ${
                          t.type === 'income' ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {t.type === 'income' ? '+' : '-'}{t.amount.toFixed(2)}$
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-2 gap-12 mt-16 pt-10 border-t border-dashed border-zinc-300">
                <div className="text-center">
                  <span className="text-[10px] text-zinc-400 block uppercase tracking-wider">Visa du Caissier</span>
                  <div className="h-16 border-b border-zinc-300 w-48 mx-auto mt-2"></div>
                  <span className="text-[10px] text-zinc-700 font-bold block mt-2">{currentUser.name}</span>
                </div>
                
                <div className="text-center">
                  <span className="text-[10px] text-zinc-400 block uppercase tracking-wider">Visa de la Direction</span>
                  <div className="h-16 border-b border-zinc-300 w-48 mx-auto mt-2"></div>
                  <span className="text-[10px] text-zinc-500 font-medium block mt-2">Directeur Financier / Gérant</span>
                </div>
              </div>

              {/* Instructions print */}
              <div className="no-print mt-12 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3.5 text-xs text-center flex items-center justify-center gap-2">
                <span>💡</span>
                <p>
                  Ce document est optimisé pour l'impression A4 standard et l'enregistrement PDF. Les contrôles ne seront pas visibles à l'impression.
                </p>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
