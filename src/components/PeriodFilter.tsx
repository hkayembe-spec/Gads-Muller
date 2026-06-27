import React, { useState } from 'react';
import { Calendar, RefreshCw, ChevronDown, CheckCheck, Sparkles, Filter } from 'lucide-react';

interface PeriodFilterProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export default function PeriodFilter({ startDate, endDate, onChange }: PeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatLocalISO = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPresetStates = () => {
    const today = new Date();
    const todayStr = formatLocalISO(today);

    // Current month variables:
    const startOfMonth = formatLocalISO(new Date(today.getFullYear(), today.getMonth(), 1));

    // Previous month variables:
    const startOfPrevMonth = formatLocalISO(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    const endOfPrevMonth = formatLocalISO(new Date(today.getFullYear(), today.getMonth(), 0));

    return { todayStr, startOfMonth, startOfPrevMonth, endOfPrevMonth };
  };

  const { todayStr, startOfMonth, startOfPrevMonth, endOfPrevMonth } = getPresetStates();

  // Quick select presets
  const handlePreset = (type: 'today' | 'yesterday' | 'week' | 'month' | 'prev_month' | 'all') => {
    const today = new Date();
    
    switch (type) {
      case 'today':
        onChange(todayStr, todayStr);
        break;
      case 'yesterday':
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const yestStr = formatLocalISO(yesterday);
        onChange(yestStr, yestStr);
        break;
      case 'week':
        const lastWeek = new Date();
        lastWeek.setDate(today.getDate() - 7);
        onChange(formatLocalISO(lastWeek), todayStr);
        break;
      case 'month':
        onChange(startOfMonth, todayStr);
        break;
      case 'prev_month':
        onChange(startOfPrevMonth, endOfPrevMonth);
        break;
      case 'all':
      default:
        onChange('', '');
        break;
    }
  };

  const getActiveFilterLabel = () => {
    if (!startDate && !endDate) return "Toutes les dates";
    
    if (startDate === startOfMonth && endDate === todayStr) {
      return "Mois en cours";
    }

    if (startDate === startOfPrevMonth && endDate === endOfPrevMonth) {
      return "Mois précédent";
    }

    if (startDate && startDate === endDate) {
      if (startDate === todayStr) return "Aujourd'hui";
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yestStr = formatLocalISO(yesterday);
      if (startDate === yestStr) return "Hier";
      return `Date: ${new Date(startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    }
    
    const startFmt = startDate ? new Date(startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : 'Début';
    const endFmt = endDate ? new Date(endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : 'Fin';
    return `Période: ${startFmt} au ${endFmt}`;
  };

  const isFiltered = startDate || endDate;

  return (
    <div className="bg-[#121212]/90 border border-zinc-800/80 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4" id="calendar-filter-bar">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0">
          <Calendar size={20} />
        </div>
        <div>
          <h4 className="text-xs text-zinc-500 uppercase tracking-widest font-black">Filtre Temporel</h4>
          <p className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
            <span>{getActiveFilterLabel()}</span>
            {isFiltered && (
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Presets Group */}
        <div className="flex bg-black/40 border border-zinc-850 p-1 rounded-lg shrink-0 overflow-x-auto scrollbar-hide">
          <button 
            type="button"
            onClick={() => handlePreset('today')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              startDate && startDate === endDate && startDate === todayStr
                ? 'bg-yellow-500 text-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Aujourd'hui
          </button>
          <button 
            type="button"
            onClick={() => handlePreset('yesterday')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              startDate && startDate === endDate && startDate === formatLocalISO(new Date(new Date().setDate(new Date().getDate() - 1)))
                ? 'bg-yellow-500 text-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Hier
          </button>
          <button 
            type="button"
            onClick={() => handlePreset('week')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              startDate && endDate && startDate === formatLocalISO(new Date(new Date().setDate(new Date().getDate() - 7))) && endDate === todayStr
                ? 'bg-yellow-500 text-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            7J
          </button>
          <button 
            type="button"
            onClick={() => handlePreset('month')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              startDate && endDate && startDate === startOfMonth && endDate === todayStr
                ? 'bg-yellow-500 text-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Mois en cours
          </button>
          <button 
            type="button"
            onClick={() => handlePreset('prev_month')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              startDate && endDate && startDate === startOfPrevMonth && endDate === endOfPrevMonth
                ? 'bg-yellow-500 text-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Mois précédent
          </button>
        </div>

        {/* Custom Calendar date pickups */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => onChange(e.target.value, endDate)}
              className="bg-[#18181b] border border-zinc-800 text-zinc-300 rounded-lg px-2 text-xs py-2 outline-none focus:border-yellow-500/80 transition-all font-medium select-none w-32 cursor-pointer relative"
              title="Date de début"
            />
          </div>
          <span className="text-zinc-600 text-xs font-semibold">à</span>
          <div className="relative">
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => onChange(startDate, e.target.value)}
              className="bg-[#18181b] border border-zinc-800 text-zinc-300 rounded-lg px-2 text-xs py-2 outline-none focus:border-yellow-500/80 transition-all font-medium select-none w-32 cursor-pointer relative"
              title="Date de fin"
            />
          </div>

          {/* Reset button */}
          {isFiltered && (
            <button
              onClick={() => handlePreset('all')}
              className="p-2 bg-yellow-550/10 hover:bg-yellow-500 hover:text-black transition-colors rounded-lg text-yellow-500 border border-yellow-500/20 cursor-pointer flex items-center justify-center shrink-0"
              title="Vider les filtres de calendrier"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
