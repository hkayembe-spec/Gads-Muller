import React, { useState } from 'react';
import { ClientSession, User } from '../types';
import { Calendar, MessageCircle, BarChart3, TrendingUp, Gamepad2, Layers, BookOpen, Download, FileText, Coffee, Cookie } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface ReportsProps {
  sessions: ClientSession[];
  currentUser: User;
  startDate?: string;
  endDate?: string;
}

export default function Reports({ sessions, currentUser, startDate, endDate }: ReportsProps) {
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Utility to filter sessions by current day, week or month
  const getPeriodSessions = () => {
    const paidSessions = sessions.filter(s => s.paymentStatus === 'paid');

    // If there is an active global calendar scope filter, we bypass local tab limitations to display accurate numbers
    if (startDate || endDate) {
      return paidSessions;
    }

    const now = new Date();
    return paidSessions.filter(s => {
      const date = new Date(s.updatedAt);
      
      if (reportPeriod === 'daily') {
        return date.toDateString() === now.toDateString();
      }
      
      if (reportPeriod === 'weekly') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return date >= oneWeekAgo && date <= now;
      }
      
      if (reportPeriod === 'monthly') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }

      return true;
    });
  };

  const periodSessions = getPeriodSessions();

  // Metrics calculation
  const totalClients = periodSessions.length;
  const totalMatches = periodSessions.reduce((acc, s) => acc + s.matchesCount, 0);
  const totalRevenue = periodSessions.reduce((acc, s) => acc + s.totalAmount, 0);

  // Consumables statistics
  const totalDrinks = periodSessions.reduce((acc, s) => acc + (s.drinksCount || 0), 0);
  const totalSnacks = periodSessions.reduce((acc, s) => acc + (s.snacksCount || 0), 0);
  const totalDrinksRevenue = periodSessions.reduce((acc, s) => acc + (s.drinksAmount || 0), 0);
  const totalSnacksRevenue = periodSessions.reduce((acc, s) => acc + (s.snacksAmount || 0), 0);

  // Split by console categories
  const breakdown = {
    ps5: { sessions: 0, matches: 0, revenue: 0 },
    ps4: { sessions: 0, matches: 0, revenue: 0 },
    ps3: { sessions: 0, matches: 0, revenue: 0 }
  };

  periodSessions.forEach(s => {
    const type = s.consoleType;
    if (breakdown[type]) {
      breakdown[type].sessions++;
      breakdown[type].matches += s.matchesCount;
      breakdown[type].revenue += s.totalAmount;
    }
  });

  // Calculate percentage traffic
  const getPercentage = (matchesCount: number) => {
    if (totalMatches === 0) return 0;
    return Math.round((matchesCount / totalMatches) * 100);
  };

  // Generate daily evolution data based on selected period
  const getDailyEvolutionData = () => {
    const result: { date: string; revenue: number; _key: string }[] = [];

    if (startDate && endDate) {
      // Loop from startDate to endDate day-by-day to display accurate calendar selection
      const start = new Date(startDate);
      const end = new Date(endDate);
      const current = new Date(start);
      let count = 0;
      
      while (current <= end && count < 90) { // Safety ceiling to prevent endless loops
        const dateStr = current.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        result.push({
          date: dateStr,
          revenue: 0,
          _key: current.toDateString()
        });
        current.setDate(current.getDate() + 1);
        count++;
      }
    } else {
      // For general daily & weekly, show last 7 days. For monthly, show last 30 days.
      const daysCount = reportPeriod === 'monthly' ? 30 : 7;
      const now = new Date();

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        result.push({
          date: dateStr,
          revenue: 0,
          _key: d.toDateString()
        });
      }
    }

    const paidSessions = sessions.filter(s => s.paymentStatus === 'paid');
    paidSessions.forEach(s => {
      const sessionDateStr = new Date(s.updatedAt).toDateString();
      const match = result.find(r => r._key === sessionDateStr);
      if (match) {
        match.revenue += s.totalAmount;
      }
    });

    return result.map(({ date, revenue }) => ({
      date,
      revenue: Number(revenue.toFixed(2))
    }));
  };

  const evolutionData = getDailyEvolutionData();

  // Pie chart dataset for revenue breakdown by console category
  const pieData = [
    { name: 'PlayStation 5', value: Number(breakdown.ps5.revenue.toFixed(2)), color: '#fbbf24' },
    { name: 'PlayStation 4', value: Number(breakdown.ps4.revenue.toFixed(2)), color: '#3b82f6' },
    { name: 'PlayStation 3', value: Number(breakdown.ps3.revenue.toFixed(2)), color: '#ec4899' },
  ].filter(item => item.value > 0);

  // Generate WhatsApp text report
  const handleSendWhatsApp = () => {
    const periodLabel = reportPeriod === 'daily' ? 'JOURNALIER' : reportPeriod === 'weekly' ? 'HEBDOMADAIRE' : 'MENSUEL';
    const dateStr = new Date().toLocaleDateString('fr-FR');
    
    // Construct text message
    const textReport = `🏆 *NOVA CASINO PLAYSTATION - RAPPORT DE VENTES (${periodLabel})* 🏆
--------------------------------------------
*Auteur:* ${currentUser.name} (${currentUser.role.toUpperCase()})
*Date de Génération:* ${dateStr}

📊 *STATISTIQUES GENERALES*
• Nombre de clients: *${totalClients}*
• Nombre total de matchs: *${totalMatches}*
• Revenus validés: *${totalRevenue.toFixed(2)}$*

🎮 *VENTES PAR CATEGORIE DE CONSOLE*

🔥 *PLAYSTATION 5* ($0.50/match)
- Sessions: ${breakdown.ps5.sessions}
- Matchs joués: ${breakdown.ps5.matches}
- Revenu généré: *${breakdown.ps5.revenue.toFixed(2)}$* (${getPercentage(breakdown.ps5.matches)}%)

⚡ *PLAYSTATION 4* ($0.25/match)
- Sessions: ${breakdown.ps4.sessions}
- Matchs joués: ${breakdown.ps4.matches}
- Revenu généré: *${breakdown.ps4.revenue.toFixed(2)}$* (${getPercentage(breakdown.ps4.matches)}%)

👾 *PLAYSTATION 3* ($0.10/match)
- Sessions: ${breakdown.ps3.sessions}
- Matchs joués: ${breakdown.ps3.matches}
- Revenu généré: *${breakdown.ps3.revenue.toFixed(2)}$* (${getPercentage(breakdown.ps3.matches)}%)

--------------------------------------------
*Novacasino Gaming system v1.0*`;

    const encodedText = encodeURIComponent(textReport);
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  // Export full sessions history to CSV format for Directors / Admin
  const handleExportCSV = () => {
    const headers = [
      'ID Session',
      'Nom Client',
      'Console N°',
      'Console Type',
      'Téléphone',
      'Nombre Matchs',
      'Tarif par Match',
      'Montant Total ($)',
      'Statut Paiement',
      'Validé par',
      'Créé par',
      'Date Création',
      'Dernière Mise à jour'
    ];

    const csvRows = [headers.join(',')];

    sessions.forEach(s => {
      const row = [
        s.id,
        `"${(s.clientName || '').replace(/"/g, '""')}"`,
        `"${(s.consoleNumber || '').replace(/"/g, '""')}"`,
        s.consoleType.toUpperCase(),
        `"${(s.phoneNumber || '').replace(/"/g, '""')}"`,
        s.matchesCount,
        s.costPerMatch,
        s.totalAmount,
        s.paymentStatus === 'paid' ? 'Payé' : 'En attente',
        `"${(s.paymentValidatedByName || s.paymentValidatedBy || '').replace(/"/g, '""')}"`,
        `"${(s.createdByName || s.createdBy || '').replace(/"/g, '""')}"`,
        `"${new Date(s.createdAt).toLocaleString('fr-FR')}"`,
        `"${new Date(s.updatedAt).toLocaleString('fr-FR')}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    // Using BOM character for proper UTF-8 interpretation, fixing MS Excel accents encoding
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `nova_casino_sessions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export current period report with complete statistics and raw sessions to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const periodLabel = reportPeriod === 'daily' ? 'JOURNALIER' : reportPeriod === 'weekly' ? 'HEBDOMADAIRE' : 'MENSUEL';
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const timeStr = new Date().toLocaleTimeString('fr-FR');

    let y = 15;

    // Header block
    doc.setFillColor(20, 20, 20); // #141414
    doc.rect(15, y, 180, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('NOVA CASINO PLAYSTATION', 22, y + 8);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(`RAPPORT D'ACTIVITE ET SYNTHESE FINANCIERE (${periodLabel})`, 22, y + 14);

    doc.setFontSize(8);
    doc.setTextColor(234, 179, 8); // Gold #eab308
    doc.text(`Opérateur: ${currentUser.name} (${currentUser.role.toUpperCase()}) | Extrait le ${dateStr} à ${timeStr}`, 22, y + 19);

    y += 33;

    // SECTION 1: STATISTIQUES CENTRALES
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(24, 24, 27);
    doc.text("📊 STATISTIQUES OPERATIONNELLES ET FINANCIERES", 15, y);
    doc.setDrawColor(228, 228, 231);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;

    // Column 1: Sessions
    doc.setFillColor(244, 244, 245);
    doc.rect(15, y, 56, 18, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122);
    doc.text("SESSIONS ENREGISTREES", 18, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(24, 24, 27);
    doc.text(`${totalClients} sessions`, 18, y + 12);

    // Column 2: Matches
    doc.setFillColor(244, 244, 245);
    doc.rect(77, y, 56, 18, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122);
    doc.text("MATCHS ENREGISTRES", 80, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(24, 24, 27);
    doc.text(`${totalMatches} matchs`, 80, y + 12);

    // Column 3: CA
    doc.setFillColor(254, 243, 199); // Amber-100
    doc.rect(139, y, 56, 18, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9);
    doc.text("CHIFFRE D'AFFAIRES VALIDÉ", 142, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(180, 83, 9);
    doc.text(`$${totalRevenue.toFixed(2)}`, 142, y + 12);

    y += 24;

    // SECTION 1.5: SYNTHÈSE DES CONSOMMATIONS
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(24, 24, 27);
    doc.text("🍹 VENTES DE BOISSONS ET SNACKS DURANT LES SESSIONS", 15, y);
    doc.setDrawColor(228, 228, 231);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;

    // Row Boissons
    doc.setFillColor(244, 244, 245);
    doc.rect(15, y, 180, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(24, 24, 27);
    doc.text("Boissons fraîches (Tarif $0.80 / cannette)", 18, y + 5.5);
    doc.text(`Quantité: ${totalDrinks} cannettes`, 100, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${totalDrinksRevenue.toFixed(2)}`, 160, y + 5.5);
    y += 8;

    // Row Snacks
    doc.setFillColor(250, 250, 250);
    doc.rect(15, y, 180, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(24, 24, 27);
    doc.text("Snacks & Friandises (Tarif $1.00 / paquet)", 18, y + 5.5);
    doc.text(`Quantité: ${totalSnacks} paquets`, 100, y + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${totalSnacksRevenue.toFixed(2)}`, 160, y + 5.5);
    y += 8;

    y += 6;

    // SECTION 2: SYNTHÈSE DES CATEGORIES CONSOLE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(24, 24, 27);
    doc.text("🎮 ANALYSE DES CATÉGORIES DE PLAYSTATION (Points 7 & 9)", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;

    // Table head consoles
    doc.setFillColor(228, 228, 231);
    doc.rect(15, y, 180, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(63, 63, 70);
    doc.text("Modèle de Console", 18, y + 4.5);
    doc.text("Prix unitaire / Match", 65, y + 4.5);
    doc.text("Volume Sessions", 100, y + 4.5);
    doc.text("Volume Matchs", 130, y + 4.5);
    doc.text("Revenu Réalisé ($)", 160, y + 4.5);

    y += 7;

    const buildConsoleRow = (label: string, rate: string, rowData: any) => {
      doc.setFillColor(250, 250, 250);
      doc.rect(15, y, 180, 8, 'F');
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(24, 24, 27);
      doc.text(label, 18, y + 5);
      doc.text(rate, 65, y + 5);
      doc.text(String(rowData.sessions), 100, y + 5);
      doc.text(String(rowData.matches), 130, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${rowData.revenue.toFixed(2)}`, 160, y + 5);
      
      doc.setDrawColor(244, 244, 245);
      doc.line(15, y + 8, 195, y + 8);
      y += 8;
    };

    buildConsoleRow("PlayStation 5 (Tarif $0.50)", "$0.50", breakdown.ps5);
    buildConsoleRow("PlayStation 4 (Tarif $0.25)", "$0.25", breakdown.ps4);
    buildConsoleRow("PlayStation 3 (Tarif $0.10)", "$0.10", breakdown.ps3);

    y += 6;

    // SECTION 3: LISTE CHRONOLOGIQUE DES SESSIONS
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(24, 24, 27);
    doc.text("📋 JOURNAL DÉTAILLÉ DES SESSIONS COMPTABILISÉES", 15, y);
    doc.setDrawColor(228, 228, 231);
    doc.line(15, y + 2, 195, y + 2);

    y += 7;

    if (periodSessions.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(113, 113, 122);
      doc.text("Aucune session comptabilisée ni réglée sur cette période.", 15, y + 5);
    } else {
      // Table Header for session log
      doc.setFillColor(24, 24, 27);
      doc.rect(15, y, 180, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("Date & Heure", 18, y + 4.5);
      doc.text("Client", 52, y + 4.5);
      doc.text("Console", 90, y + 4.5);
      doc.text("Matchs", 125, y + 4.5);
      doc.text("Tarif / M", 143, y + 4.5);
      doc.text("Total ($)", 160, y + 4.5);
      doc.text("Validé par", 178, y + 4.5);

      y += 7;

      periodSessions.forEach((s, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 15;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(113, 113, 122);
          doc.text(`Rapport de Ventes Nova Casino (Suite) - Extrait du ${dateStr}`, 15, y);
          y += 5;

          // Re-draw headers on new page
          doc.setFillColor(24, 24, 27);
          doc.rect(15, y, 180, 7, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(255, 255, 255);
          doc.text("Date & Heure", 18, y + 4.5);
          doc.text("Client", 52, y + 4.5);
          doc.text("Console", 90, y + 4.5);
          doc.text("Matchs", 125, y + 4.5);
          doc.text("Tarif / M", 143, y + 4.5);
          doc.text("Total ($)", 160, y + 4.5);
          doc.text("Validé par", 178, y + 4.5);
          y += 7;
        }

        // Alternating row background
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
        } else {
          doc.setFillColor(240, 240, 242);
        }
        doc.rect(15, y, 180, 8, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(24, 24, 27);

        const timestampStr = new Date(s.updatedAt).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        doc.text(timestampStr, 18, y + 5);

        const truncClient = s.clientName && s.clientName.length > 18 ? s.clientName.substring(0, 16) + ".." : s.clientName || 'Anonyme';
        doc.text(truncClient, 52, y + 5);

        const consoleLabelDetail = `N° ${s.consoleNumber} (${s.consoleType.toUpperCase()})`;
        doc.text(consoleLabelDetail, 90, y + 5);

        doc.text(String(s.matchesCount), 125, y + 5);
        doc.text(`$${s.costPerMatch.toFixed(2)}`, 143, y + 5);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`$${s.totalAmount.toFixed(2)}`, 160, y + 5);

        doc.setFont('helvetica', 'normal');
        const validatorName = s.paymentValidatedByName || s.paymentValidatedBy || '-';
        const truncValidatorName = validatorName.length > 12 ? validatorName.substring(0, 10) + ".." : validatorName;
        doc.text(truncValidatorName, 178, y + 5);

        doc.setDrawColor(228, 228, 231);
        doc.line(15, y + 8, 195, y + 8);
        y += 8;
      });
    }

    // Wrap footer
    if (y > 275) {
      doc.addPage();
      y = 15;
    }
    y += 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(161, 161, 170);
    doc.text("Ce document PDF est généré numériquement par l'application Nova Casino Gaming. Rapprochement d'activité conforme.", 15, y);

    // Save final PDF
    doc.save(`nova_casino_rapport_${periodLabel.toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 text-white" id="reports-tab">
      
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 size={24} className="text-yellow-500" />
            Rapports de Performance
          </h2>
          <p className="text-zinc-500 text-xs">Analyse journalière, hebdomadaire et mensuelle des rentrées</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Export to CSV Button for Directors & Administrators */}
          {(currentUser.role === 'director' || currentUser.role === 'admin') && (
            <>
              <button
                onClick={handleExportCSV}
                className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20 active:bg-yellow-500/30 transition-all font-extrabold text-xs px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer h-[38px] uppercase tracking-wide shrink-0 font-sans"
                title="Exporter l'historique complet au format CSV"
                id="export-csv-btn"
              >
                <Download size={14} /> Exporter en CSV
              </button>

              <button
                onClick={handleExportPDF}
                className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30 transition-all font-extrabold text-xs px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer h-[38px] uppercase tracking-wide shrink-0 font-sans"
                title="Exporter le rapport actuel au format PDF"
                id="export-pdf-btn"
              >
                <FileText size={14} /> Exporter en PDF
              </button>
            </>
          )}

          {/* Period Selector Tabs */}
          {startDate || endDate ? (
            <div className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-500 font-extrabold text-[11px] px-3 py-2 rounded-lg leading-none select-none flex items-center gap-1.5 animate-pulse uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              Période Sélectionnée active
            </div>
          ) : (
            <div className="bg-[#141414] border border-zinc-800 p-1 rounded-lg flex gap-1">
              {([
                { id: 'daily', label: 'Journalier' },
                { id: 'weekly', label: 'Hebdo' },
                { id: 'monthly', label: 'Mensuel' }
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setReportPeriod(tab.id)}
                  className={`px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer uppercase ${
                    reportPeriod === tab.id
                      ? 'bg-yellow-500 text-black font-extrabold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-805'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main stats visual summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#141414] border border-zinc-850 rounded-xl p-5 text-center">
          <p className="text-zinc-500 text-xs uppercase font-semibold">
            Clients {startDate || endDate ? '(Sélection)' : `(${reportPeriod === 'daily' ? 'Aujourd\'hui' : reportPeriod === 'weekly' ? 'Cette Semaine' : 'Ce Mois'})`}
          </p>
          <h3 className="text-4xl font-black text-yellow-500 mt-2">{totalClients}</h3>
          <p className="text-[10px] text-zinc-500 mt-1">Nombre total de sessions payées</p>
        </div>

        <div className="bg-[#141414] border border-zinc-850 rounded-xl p-5 text-center">
          <p className="text-zinc-500 text-xs uppercase font-semibold">Matchs Joués</p>
          <h3 className="text-4xl font-black text-yellow-500 mt-2">{totalMatches}</h3>
          <p className="text-[10px] text-zinc-500 mt-1">Cumulatif des parties lancées</p>
        </div>

        <div className="bg-[#141414] border border-zinc-850 rounded-xl p-5 text-center">
          <p className="text-zinc-500 text-xs uppercase font-semibold">Revenus Encaissés</p>
          <h3 className="text-4xl font-black text-green-500 mt-2">${totalRevenue.toFixed(2)}</h3>
          <p className="text-[10px] text-zinc-500 mt-1">Somme nette des paiements validés</p>
        </div>
      </div>

      {/* Consumables sales summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#141414] border border-zinc-850 rounded-xl p-4 flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Ventes de Boissons</span>
            <span className="text-xl font-black text-emerald-400">{totalDrinks} cannettes soldées</span>
            <span className="text-[9px] text-zinc-500 block">Sous-total : ${totalDrinksRevenue.toFixed(2)} ($0.80 / cannette)</span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <Coffee size={20} />
          </div>
        </div>

        <div className="bg-[#141414] border border-zinc-850 rounded-xl p-4 flex items-center justify-between shadow-xl">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Ventes de Snacks</span>
            <span className="text-xl font-black text-[#facc15]">{totalSnacks} paquets soldés</span>
            <span className="text-[9px] text-zinc-500 block">Sous-total : ${totalSnacksRevenue.toFixed(2)} ($1.00 / paquet)</span>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-500 shrink-0">
            <Cookie size={20} />
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Daily Revenue Evolution - Area Chart */}
        <div className="lg:col-span-2 bg-[#141414] border border-white/5 rounded-xl p-6 flex flex-col justify-between shadow-lg">
          <div>
            <h4 className="text-sm font-extrabold uppercase tracking-wide text-zinc-400 mb-1 flex items-center gap-2">
              <TrendingUp size={16} className="text-yellow-500" />
              Évolution Quotidienne du Chiffre d'Affaires
            </h4>
            <p className="text-zinc-500 text-[11px] mb-6">
              {startDate || endDate 
                ? `Rentrées nettes enregistrées sur la période personnalisée du ${new Date(startDate || '').toLocaleDateString('fr-FR')} au ${new Date(endDate || '').toLocaleDateString('fr-FR')}`
                : `Rentrées nettes enregistrées par jour sur la période des ${reportPeriod === 'monthly' ? '30 derniers jours' : '7 derniers jours'}`
              }
            </p>
          </div>
          <div className="h-64 w-full text-zinc-300">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.6} />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={8}
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={11} 
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
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Chiffre d’affaires']}
                  labelStyle={{ fontWeight: 'bold', color: '#facc15' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#eab308" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Console Distribution - Pie Chart */}
        <div className="bg-[#141414] border border-white/5 rounded-xl p-6 flex flex-col justify-between shadow-lg">
          <div>
            <h4 className="text-sm font-extrabold uppercase tracking-wide text-zinc-400 mb-1 flex items-center gap-2">
              <Gamepad2 size={16} className="text-yellow-500" />
              Répartition par Console
            </h4>
            <p className="text-zinc-500 text-[11px] mb-6">
              {startDate || endDate
                ? 'Part de revenus générée par modèle de PlayStation sur la période'
                : `Part de revenus générée par modèle de PlayStation (${reportPeriod === 'daily' ? 'aujourd’hui' : reportPeriod === 'weekly' ? 'cette semaine' : 'ce mois'})`
              }
            </p>
          </div>
          
          <div className="h-44 w-full flex items-center justify-center relative">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      borderRadius: '8px', 
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenu']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-zinc-500 text-xs text-center flex flex-col items-center gap-2">
                <BookOpen size={24} className="text-zinc-600" />
                Détails indisponibles
              </div>
            )}
            {pieData.length > 0 && (
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] uppercase tracking-wider text-zinc-500 leading-none">Total</span>
                <span className="text-sm font-black text-white mt-1">${totalRevenue.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Color Legend Tags */}
          <div className="space-y-2 mt-4">
            {pieData.length > 0 ? (
              pieData.map((item, index) => {
                const pct = totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(0) : '0';
                return (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-zinc-400 font-medium">{item.name}</span>
                    </div>
                    <div className="font-bold text-zinc-200">
                      ${item.value.toFixed(2)} <span className="text-zinc-500 text-[10px] font-normal">({pct}%)</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[10px] text-zinc-500 text-center">Aucune donnée sur cette période</p>
            )}
          </div>
        </div>

      </div>

      {/* Detailed calculations tables per Console Category */}
      <div className="bg-[#141414] border border-zinc-800 rounded-xl p-6">
        <h4 className="text-sm font-extrabold uppercase tracking-wide text-zinc-400 mb-4 flex items-center gap-2">
          <Layers size={16} className="text-yellow-500" />
          Rapprochement Comptable par Console (Points 7 & 9)
        </h4>

        <div className="space-y-4">
          
          {/* PS5 Row Detail */}
          <div className="p-4 bg-black/40 border border-zinc-800/40 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="w-8 h-8 rounded-lg bg-yellow-505/10 flex items-center justify-center text-yellow-500 font-extrabold shrink-0">5</span>
              <div>
                <h5 className="font-extrabold text-sm text-white">Console PS5 (High tier)</h5>
                <p className="text-[10px] text-zinc-500 uppercase mt-0.5">Fréquence de calcul: $0.50 par match</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center w-full sm:w-80">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Sessions</p>
                <p className="font-bold text-sm text-white">{breakdown.ps5.sessions}</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Matchs</p>
                <p className="font-bold text-sm text-yellow-500">{breakdown.ps5.matches}</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Revenu</p>
                <p className="font-bold text-sm text-green-500">${breakdown.ps5.revenue.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* PS4 Row Detail */}
          <div className="p-4 bg-black/40 border border-zinc-800/40 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="w-8 h-8 rounded-lg bg-yellow-505/10 flex items-center justify-center text-yellow-500 font-extrabold shrink-0">4</span>
              <div>
                <h5 className="font-extrabold text-sm text-white">Console PS4 (Standard tier)</h5>
                <p className="text-[10px] text-zinc-500 uppercase mt-0.5">Fréquence de calcul: $0.25 par match</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center w-full sm:w-80">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Sessions</p>
                <p className="font-bold text-sm text-white">{breakdown.ps4.sessions}</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Matchs</p>
                <p className="font-bold text-sm text-yellow-500">{breakdown.ps4.matches}</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Revenu</p>
                <p className="font-bold text-sm text-green-500">${breakdown.ps4.revenue.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* PS3 Row Detail */}
          <div className="p-4 bg-black/40 border border-zinc-800/40 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="w-8 h-8 rounded-lg bg-yellow-505/10 flex items-center justify-center text-yellow-500 font-extrabold shrink-0">3</span>
              <div>
                <h5 className="font-extrabold text-sm text-white">Console PS3 (Classic tier)</h5>
                <p className="text-[10px] text-zinc-500 uppercase mt-0.5">Fréquence de calcul: $0.10 par match</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center w-full sm:w-80">
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Sessions</p>
                <p className="font-bold text-sm text-white">{breakdown.ps3.sessions}</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Matchs</p>
                <p className="font-bold text-sm text-yellow-500">{breakdown.ps3.matches}</p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 uppercase">Revenu</p>
                <p className="font-bold text-sm text-green-500">${breakdown.ps3.revenue.toFixed(2)}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Shareable Buttons - WhatsApp Integration (Point 10) */}
      <div className="bg-gradient-to-r from-zinc-900 to-yellow-500/5 border border-yellow-500/20 p-5 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5">
            <MessageCircle size={18} className="text-green-500" />
            Transmettre par WhatsApp (Point 10)
          </h4>
          <p className="text-xs text-zinc-400 mt-1 max-w-lg">
            Générez instantanément le rapport complet formaté pour WhatsApp. Le système ouvrira l'application ou l'API web pour un envoi direct au caissier, administrateur ou gérant.
          </p>
        </div>
        <button
          onClick={handleSendWhatsApp}
          className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold px-6 py-3 rounded-lg flex items-center gap-2 tracking-wide text-xs transition-all shadow-md shadow-emerald-500/10 cursor-pointer w-full md:w-auto justify-center"
        >
          <MessageCircle size={16} /> Envoyer à WhatsApp
        </button>
      </div>

    </div>
  );
}
