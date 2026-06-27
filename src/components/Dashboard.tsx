import React from 'react';
import { User, ClientSession } from '../types';
import { Play, ClipboardList, TrendingUp, Gamepad2, Coins, Tv, HelpCircle, Coffee, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface DashboardStats {
  totalClients: number;
  totalMatches: number;
  totalRevenue: number;
  totalPending: number;
  categories: {
    ps5: { sessionsCount: number; matchesCount: number; revenue: number };
    ps4: { sessionsCount: number; matchesCount: number; revenue: number };
    ps3: { sessionsCount: number; matchesCount: number; revenue: number };
  };
}

interface DashboardProps {
  stats: DashboardStats;
  currentUser: User;
  sessions: ClientSession[];
  transactions?: any[];
  inventoryItems?: any[];
  onNavigate: (tab: string) => void;
  isLoading?: boolean;
}

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.45,
      ease: 'easeOut'
    }
  })
};

export default function Dashboard({ stats, currentUser, sessions, transactions, inventoryItems, onNavigate, isLoading = false }: DashboardProps) {
  // Find boissons and snacks quantities from inventoryItems
  const drinkItem = (inventoryItems || []).find(i => i.id === 'inv-boissons' || i.category === 'Boissons');
  const snackItem = (inventoryItems || []).find(i => i.id === 'inv-snacks' || i.category === 'Snacks');
  const drinkQty = drinkItem ? drinkItem.quantity : 100;
  const snackQty = snackItem ? snackItem.quantity : 100;

  // Generate daily revenue & expenses for the last 7 days from financial transactions and sessions
  const get7DaysFinance = () => {
    const result: { date: string; revenue: number; expense: number; _key: string }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const matchKey = `${yyyy}-${mm}-${dd}`;

      result.push({
        date: dateStr,
        revenue: 0,
        expense: 0,
        _key: matchKey
      });
    }

    const txs = transactions || [];
    const representedSessionIds = new Set(
      txs
        .filter(t => t.id && (t.id.startsWith('fin-sess-') || t.id.startsWith('sess-')))
        .map(t => t.id.replace('fin-sess-', '').replace('sess-', ''))
    );

    txs.forEach(t => {
      const tDateStr = t.date;
      const match = result.find(r => r._key === tDateStr);
      if (match) {
        if (t.type === 'income') {
          match.revenue += t.amount;
        } else if (t.type === 'expense') {
          match.expense += t.amount;
        }
      }
    });

    // Also include any paid sessions that are not explicitly in transactions
    const paidSessions = (sessions || []).filter(s => s.paymentStatus === 'paid' && !representedSessionIds.has(s.id));
    paidSessions.forEach(s => {
      const d = s.updatedAt ? new Date(s.updatedAt) : new Date(s.createdAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const sessionDateStr = `${yyyy}-${mm}-${dd}`;
      
      const match = result.find(r => r._key === sessionDateStr);
      if (match) {
        match.revenue += s.totalAmount;
      }
    });

    return result.map(({ date, revenue, expense }) => ({
      date,
      revenue: Number(revenue.toFixed(2)),
      expense: Number(expense.toFixed(2))
    }));
  };

  const chartData = get7DaysFinance();

  return (
    <div className="space-y-6 text-white" id="dashboard-tab">
      
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-zinc-900 via-stone-900 to-zinc-900 rounded-xl border border-yellow-500/20 shadow-lg">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-1">
            BIENVENUE, <span className="text-yellow-500 uppercase">{currentUser.name}</span>
          </h1>
          <p className="text-zinc-400 text-sm">
            Vue d'ensemble de votre salle PlayStation <span className="text-yellow-500/80 font-bold">Nova Casino</span>
          </p>
        </div>
        <button 
          onClick={() => onNavigate('new-client')}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-extrabold px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm shadow-md shadow-yellow-500/10 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <Gamepad2 size={18} /> + Nouveau Client
        </button>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" key={isLoading ? 'loading' : 'loaded'}>
        
        {/* Clients Card */}
        <motion.div 
          custom={0}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="bg-[#151515] border border-white/5 rounded-xl p-5 hover:border-yellow-500/30 transition-all flex items-center gap-4 shadow-lg"
        >
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0">
            <ClipboardList size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Clients Enregistrés</p>
            {isLoading ? (
              <div className="h-7 w-20 bg-zinc-800 animate-pulse rounded mt-1.5 mb-1" />
            ) : (
              <h3 className="text-2xl font-black text-yellow-500 mt-1">{stats.totalClients}</h3>
            )}
            <p className="text-xs text-zinc-400 mt-0.5 truncate">Sessions actives & terminées</p>
          </div>
        </motion.div>

        {/* Matches Card */}
        <motion.div 
          custom={1}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="bg-[#151515] border border-white/5 rounded-xl p-5 hover:border-yellow-500/30 transition-all flex items-center gap-4 shadow-lg"
        >
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0">
            <Gamepad2 size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Matchs Joués</p>
            {isLoading ? (
              <div className="h-7 w-20 bg-zinc-800 animate-pulse rounded mt-1.5 mb-1" />
            ) : (
              <h3 className="text-2xl font-black text-yellow-500 mt-1">{stats.totalMatches}</h3>
            )}
            <p className="text-xs text-zinc-400 mt-0.5 truncate">Toutes consoles confondues</p>
          </div>
        </motion.div>

        {/* Revenue Card */}
        <motion.div 
          custom={2}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="bg-[#151515] border border-white/5 rounded-xl p-5 hover:border-yellow-500/30 transition-all flex items-center gap-4 shadow-lg"
        >
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
            <Coins size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#a1a1aa] text-xs uppercase tracking-wider font-semibold">Revenus Validés</p>
            {isLoading ? (
              <div className="h-7 w-24 bg-zinc-800 animate-pulse rounded mt-1.5 mb-1" />
            ) : (
              <h3 className="text-2xl font-black text-green-500 mt-1">${stats.totalRevenue.toFixed(2)}</h3>
            )}
            <p className="text-xs text-zinc-400 mt-0.5 truncate">Paiements validés encaissés</p>
          </div>
        </motion.div>

        {/* Pending Payments Card */}
        <motion.div 
          custom={3}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className="bg-[#151515] border border-white/5 rounded-xl p-5 hover:border-yellow-500/30 transition-all flex items-center gap-4 shadow-lg"
        >
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0">
            <TrendingUp size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">En Attente</p>
            {isLoading ? (
              <div className="h-7 w-24 bg-zinc-800 animate-pulse rounded mt-1.5 mb-1" />
            ) : (
              <h3 className="text-2xl font-black text-yellow-400 mt-1">${stats.totalPending.toFixed(2)}</h3>
            )}
            <p className="text-xs text-zinc-400 mt-0.5 truncate">Tickets à valider</p>
          </div>
        </motion.div>

      </div>

      {/* Category Console Stats Graph & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PS5 Details Box */}
        <div className="bg-[#151515] border border-white/5 hover:border-yellow-500/20 rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <h4 className="font-extrabold text-lg text-white">PLAYSTATION 5</h4>
            </div>
            <span className="text-xs bg-yellow-500/10 text-yellow-500 font-bold px-2 py-0.5 rounded">
              $0.50 / match
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center bg-black/40 p-3 rounded-lg">
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Sessions</p>
              <p className="text-lg font-bold text-white mt-1">{stats.categories.ps5.sessionsCount}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Matchs</p>
              <p className="text-lg font-bold text-yellow-500 mt-1">{stats.categories.ps5.matchesCount}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Revenus</p>
              <p className="text-lg font-bold text-green-500 mt-1">${stats.categories.ps5.revenue.toFixed(2)}</p>
            </div>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-yellow-500 rounded-full transition-all duration-500"
              style={{ width: `${stats.totalMatches ? (stats.categories.ps5.matchesCount / stats.totalMatches) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400 text-right">
            {stats.totalMatches ? Math.round((stats.categories.ps5.matchesCount / stats.totalMatches) * 100) : 0}% du trafic total
          </p>
        </div>

        {/* PS4 Details Box */}
        <div className="bg-[#151515] border border-white/5 hover:border-yellow-500/20 rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
              <h4 className="font-extrabold text-lg text-white">PLAYSTATION 4</h4>
            </div>
            <span className="text-xs bg-yellow-400/10 text-yellow-400 font-bold px-2 py-0.5 rounded">
              $0.25 / match
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center bg-black/40 p-3 rounded-lg">
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Sessions</p>
              <p className="text-lg font-bold text-white mt-1">{stats.categories.ps4.sessionsCount}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Matchs</p>
              <p className="text-lg font-bold text-yellow-500 mt-1">{stats.categories.ps4.matchesCount}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Revenus</p>
              <p className="text-lg font-bold text-green-500 mt-1">${stats.categories.ps4.revenue.toFixed(2)}</p>
            </div>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${stats.totalMatches ? (stats.categories.ps4.matchesCount / stats.totalMatches) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400 text-right">
            {stats.totalMatches ? Math.round((stats.categories.ps4.matchesCount / stats.totalMatches) * 100) : 0}% du trafic total
          </p>
        </div>

        {/* PS3 Details Box */}
        <div className="bg-[#151515] border border-white/5 hover:border-yellow-500/20 rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-zinc-400"></span>
              <h4 className="font-extrabold text-lg text-white">PLAYSTATION 3</h4>
            </div>
            <span className="text-xs bg-[#27272a] text-zinc-300 font-bold px-2 py-0.5 rounded">
              $0.10 / match
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center bg-black/40 p-3 rounded-lg">
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Sessions</p>
              <p className="text-lg font-bold text-white mt-1">{stats.categories.ps3.sessionsCount}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Matchs</p>
              <p className="text-lg font-bold text-yellow-500 mt-1">{stats.categories.ps3.matchesCount}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase">Revenus</p>
              <p className="text-lg font-bold text-green-500 mt-1">${stats.categories.ps3.revenue.toFixed(2)}</p>
            </div>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-zinc-400 rounded-full transition-all duration-500"
              style={{ width: `${stats.totalMatches ? (stats.categories.ps3.matchesCount / stats.totalMatches) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400 text-right">
            {stats.totalMatches ? Math.round((stats.categories.ps3.matchesCount / stats.totalMatches) * 100) : 0}% du trafic total
          </p>
        </div>

      </div>

      {/* 7 Days Revenue Evolution Chart */}
      <div className="bg-[#151515] border border-white/5 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h4 className="text-sm font-extrabold uppercase tracking-wide text-zinc-400 flex items-center gap-2">
              <TrendingUp size={16} className="text-yellow-500" />
              Évolution du Chiffre d'Affaires (7 Derniers Jours)
            </h4>
            <p className="text-zinc-500 text-[11px] mt-0.5">
              Suivi quotidien des rentrées nettes (Revenus) et des charges (Dépenses)
            </p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 font-extrabold text-[10px] px-2.5 py-1 rounded-md tracking-wider uppercase select-none self-start sm:self-auto">
            Graphique Linéaire
          </div>
        </div>

        <div className="h-64 w-full text-zinc-300">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.4} />
              <XAxis 
                dataKey="date" 
                stroke="#71717a" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                dy={8}
              />
              <YAxis 
                stroke="#71717a" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `$${val}`}
                dx={-8}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#18181b', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(250, 204, 21, 0.2)',
                  color: '#fff',
                  fontSize: '11px'
                }}
                formatter={(value: any, name: any) => [
                  `$${Number(value).toFixed(2)}`, 
                  name === 'revenue' ? 'Revenus Encaissés' : 'Dépenses Engagées'
                ]}
                labelStyle={{ fontWeight: 'bold', color: '#facc15' }}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle" 
                fontSize={11}
                formatter={(value) => (
                  <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    {value === 'revenue' ? 'Revenus' : 'Dépenses'}
                  </span>
                )}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#eab308" 
                strokeWidth={3}
                activeDot={{ r: 8 }}
                dot={{ r: 4, strokeWidth: 2 }}
              />
              <Line 
                type="monotone" 
                dataKey="expense" 
                stroke="#f43f5e" 
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* État des Stocks de Consommation */}
      <div className="bg-[#151515] border border-white/5 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-yellow-500">📊 État des Stocks Boissons & Snacks</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5">Quantités disponibles en réserve pour la vente directe ou les sessions</p>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            className="text-[10px] font-black uppercase tracking-wider text-yellow-500 hover:underline cursor-pointer"
          >
            Gérer le stock ➜
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Boissons Card */}
          <div className="bg-black/25 border border-zinc-800/60 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                drinkQty <= 20 ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
              }`}>
                <Coffee size={20} />
              </div>
              <div>
                <p className="text-zinc-400 text-xs font-bold">Stock Boissons</p>
                <h3 className={`text-xl font-black mt-0.5 ${
                  drinkQty <= 20 ? 'text-red-500' : 'text-white'
                }`}>
                  {drinkQty} <span className="text-[11px] text-zinc-500 font-normal">canettes</span>
                </h3>
              </div>
            </div>
            {drinkQty <= 20 ? (
              <span className="text-[9px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-widest animate-pulse">
                STOCK FAIBLE
              </span>
            ) : (
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                OK
              </span>
            )}
          </div>

          {/* Snacks Card */}
          <div className="bg-black/25 border border-zinc-800/60 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                snackQty <= 20 ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
              }`}>
                <ShoppingBag size={20} />
              </div>
              <div>
                <p className="text-zinc-400 text-xs font-bold">Stock Snacks</p>
                <h3 className={`text-xl font-black mt-0.5 ${
                  snackQty <= 20 ? 'text-red-500' : 'text-white'
                }`}>
                  {snackQty} <span className="text-[11px] text-zinc-500 font-normal">paquets</span>
                </h3>
              </div>
            </div>
            {snackQty <= 20 ? (
              <span className="text-[9px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-widest animate-pulse">
                STOCK FAIBLE
              </span>
            ) : (
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                OK
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Action Info Banner */}
      <div className="bg-[#0f0f0f] border border-yellow-500/10 p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-center justify-between text-zinc-400 text-xs">
        <div className="flex items-center gap-2">
          <Tv size={16} className="text-yellow-500" />
          <span>Calculateurs de console actifs et synchronisés avec le serveur central de Nova Casino.</span>
        </div>
        <div className="flex gap-2">
          <span className="bg-emerald-500/15 text-emerald-500 px-2 py-1 rounded font-bold font-mono">EN LIGNE (CLOUD)</span>
        </div>
      </div>

    </div>
  );
}
