import React from 'react';
import { ClientSession } from '../types';
import { Printer, X, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface InvoicePrintProps {
  session: ClientSession;
  cashierName: string;
  onClose: () => void;
}

export default function InvoicePrint({ session, cashierName, onClose }: InvoicePrintProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 160]
    });

    // Dark grey primary color and gold accent color
    const primaryColor = [18, 18, 18]; // #121212
    const accentColor = [234, 179, 8]; // #EAB308
    const mutedDark = [40, 40, 40];

    // Background borders for ticket style
    doc.setDrawColor(234, 179, 8); // Gold border
    doc.setLineWidth(0.4);
    doc.rect(2, 2, 76, 156);

    // Decorative Top gold stripe
    doc.setFillColor(234, 179, 8);
    doc.rect(2, 2, 76, 4, 'F');

    // Header title "NOVA CASINO" with custom elegant icon representation
    doc.setTextColor(18, 18, 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('NOVA CASINO', 40, 14, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(113, 113, 122);
    doc.text('SALLE PLAYSTATION HAUTE PERFORMANCE', 40, 19, { align: 'center' });
    doc.text('Lubumbashi, RDC', 40, 23, { align: 'center' });

    // Dotted decorator divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.25);
    let startX = 6;
    while (startX < 74) {
      doc.line(startX, 27, startX + 1.5, 27);
      startX += 3;
    }

    // Invoice meta info rows
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE N°:', 6, 33);
    doc.setFont('helvetica', 'normal');
    doc.text(session.id.substring(5, 13).toUpperCase(), 30, 33);

    doc.setFont('helvetica', 'bold');
    doc.text('DATE:', 6, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(session.createdAt).toLocaleString('fr-FR'), 30, 38);

    doc.setFont('helvetica', 'bold');
    doc.text('CAISSIER:', 6, 43);
    doc.setFont('helvetica', 'normal');
    doc.text(cashierName, 30, 43);

    // Separator
    doc.setDrawColor(220, 220, 220);
    doc.line(6, 47, 74, 47);

    // Client box with light background
    doc.setFillColor(248, 248, 248);
    doc.rect(6, 51, 68, 27, 'F');
    doc.setDrawColor(230, 230, 230);
    doc.rect(6, 51, 68, 27, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('CLIENT:', 9, 56);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 130, 10);
    doc.text(session.clientName || 'Anonyme', 28, 56);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('TELEPHONE:', 9, 61);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(session.phoneNumber || 'N/A', 28, 61);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('CONSOLE:', 9, 66);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(18, 18, 18);
    doc.text(`${session.consoleType.toUpperCase()} (N° ${session.consoleNumber})`, 28, 66);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('PAIEMENT:', 9, 71);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 120, 10);
    const pmLabel = session.paymentMethod === 'mobile_money' ? 'Mobile Money' : session.paymentMethod === 'card' ? 'Carte de credit' : 'Cash / Especes';
    doc.text(pmLabel, 28, 71);

    // Financial Table Header
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110, 110, 110);
    doc.text('Description', 6, 81);
    doc.text('Matchs', 38, 81, { align: 'center' });
    doc.text('PU ($)', 52, 81, { align: 'right' });
    doc.text('Total ($)', 74, 81, { align: 'right' });

    // Underline table header
    doc.setDrawColor(200, 200, 200);
    doc.line(6, 83, 74, 83);

    // Table item values
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    
    let currentY = 89;

    // Ticket PlayStation Row
    doc.text(`Ticket PlayStation ${session.consoleType.toUpperCase()}`, 6, currentY);
    doc.text(String(session.matchesCount), 38, currentY, { align: 'center' });
    doc.text(`$${session.costPerMatch.toFixed(2)}`, 52, currentY, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(18, 18, 18);
    doc.text(`$${(session.matchesCount * session.costPerMatch).toFixed(2)}`, 74, currentY, { align: 'right' });
    
    // Drinks Row
    if (session.drinksCount) {
      currentY += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text("Boissons / Canettes", 6, currentY);
      doc.text(String(session.drinksCount), 38, currentY, { align: 'center' });
      doc.text("$0.80", 52, currentY, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(18, 18, 18);
      doc.text(`$${(session.drinksCount * 0.8).toFixed(2)}`, 74, currentY, { align: 'right' });
    }

    // Snacks Row
    if (session.snacksCount) {
      currentY += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text("Snacks / Biscuits", 6, currentY);
      doc.text(String(session.snacksCount), 38, currentY, { align: 'center' });
      doc.text("$1.00", 52, currentY, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(18, 18, 18);
      doc.text(`$${(session.snacksCount * 1.0).toFixed(2)}`, 74, currentY, { align: 'right' });
    }

    // Separators for summary
    currentY += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(6, currentY, 74, currentY);
    doc.line(6, currentY + 1, 74, currentY + 1);

    // NET TO PAY Text
    currentY += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('NET A PAYER:', 6, currentY);
    doc.setFontSize(11);
    doc.setTextColor(190, 140, 10); // Golden dark text
    doc.text(`$${session.totalAmount.toFixed(2)}`, 74, currentY, { align: 'right' });

    // Line separator
    currentY += 8;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(6, currentY, 74, currentY);

    // Success note
    currentY += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 120, 10);
    doc.text('PAIEMENT VALIDE', 40, currentY, { align: 'center' });
    
    currentY += 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Merci pour votre visite !', 40, currentY, { align: 'center' });

    // Draw stylized custom barcode
    doc.setDrawColor(0, 0, 0);
    const barcodeXStart = 20;
    const barcodeYStart = currentY + 5;
    const barcodeHeight = 6;
    const patterns = [1.2, 2.4, 0.6, 1.8, 0.6, 2.4, 1.2, 0.6, 1.8, 1.2, 2.4, 0.6, 1.8, 0.6, 1.2, 2.4, 0.6, 1.2];
    
    let currentX = barcodeXStart;
    patterns.forEach((width) => {
      doc.setLineWidth(width * 0.22);
      doc.line(currentX, barcodeYStart, currentX, barcodeYStart + barcodeHeight);
      currentX += (width * 0.22) + 0.65;
    });

    // Device branding string at the bottom
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('NOVA-CASINO-GAMING-SYSTEM', 40, barcodeYStart + barcodeHeight + 5, { align: 'center' });

    // Save final receipt PDF 
    doc.save(`nova_casino_facture_${session.id.substring(5, 13).toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in print:bg-white print:p-0 print:absolute print:inset-0">
      <div className="bg-[#121212] border border-yellow-500/30 rounded-lg max-w-sm w-full p-6 text-white text-sm relative print:bg-white print:text-black print:border-0 print:w-full print:max-w-none print:shadow-none animate-scale-in">
        
        {/* Close Button - hidden on print */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white print:hidden transition-colors cursor-pointer"
          title="Fermer"
        >
          <X size={20} />
        </button>

        {/* Invoice Header */}
        <div className="text-center pb-4 border-b border-dashed border-yellow-500/20 print:border-slate-300">
          <div className="flex justify-center items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black font-extrabold text-lg print:bg-black print:text-white font-sans">N</span>
            <span className="font-extrabold tracking-widest text-lg text-yellow-500 print:text-black font-sans">NOVA CASINO</span>
          </div>
          <p className="text-xs text-stone-400 print:text-stone-500">Salle PlayStation Haute Performance</p>
          <p className="text-xs text-stone-400 print:text-stone-500">Lubumbashi, RDC</p>
        </div>

        {/* Invoice Body */}
        <div className="py-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-zinc-400 print:text-stone-500">Facture N°:</span>
            <span className="font-mono font-medium">{session.id.substring(5, 13).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400 print:text-stone-500">Date:</span>
            <span>{new Date(session.createdAt).toLocaleString('fr-FR')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400 print:text-stone-500">Caissier:</span>
            <span className="font-semibold">{cashierName}</span>
          </div>
          {session.paymentMethod && (
            <div className="flex justify-between">
              <span className="text-zinc-400 print:text-stone-500">Mode de paiement:</span>
              <span className="font-semibold text-yellow-500 capitalize print:text-black">
                {session.paymentMethod === 'mobile_money' ? 'Mobile Money' : session.paymentMethod === 'card' ? 'Carte de crédit' : 'Cash / Espèces'}
              </span>
            </div>
          )}

          <hr className="border-dashed border-yellow-500/20 print:border-stone-300" />

          {/* Client Details */}
          <div className="bg-stone-900/50 p-3 rounded border border-yellow-500/10 space-y-1.5 print:bg-stone-50 print:border-stone-200">
            <div className="flex justify-between">
              <span className="text-stone-400 print:text-stone-500">Client:</span>
              <span className="font-bold text-yellow-500 print:text-black">{session.clientName}</span>
            </div>
            {session.phoneNumber && (
              <div className="flex justify-between">
                <span className="text-stone-400 print:text-stone-500">Téléphone:</span>
                <span>{session.phoneNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-400 print:text-stone-500">Console:</span>
              <span className="font-semibold uppercase text-yellow-400 print:text-black">
                {session.consoleType} (N°{session.consoleNumber})
              </span>
            </div>
          </div>

          {/* Financial Breakdown */}
          <table className="w-full text-left mt-3">
            <thead>
              <tr className="border-b border-yellow-500/10 text-xs text-stone-400 print:border-stone-300 print:text-stone-500">
                <th className="pb-1">Description</th>
                <th className="pb-1 text-center">Qté</th>
                <th className="pb-1 text-right">PU ($)</th>
                <th className="pb-1 text-right">Total ($)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-yellow-500/5 print:border-stone-100">
                <td className="py-2 capitalize font-medium text-xs">Ticket {session.consoleType.toUpperCase()}</td>
                <td className="py-2 text-center text-xs">{session.matchesCount}</td>
                <td className="py-2 text-right text-xs">${session.costPerMatch.toFixed(2)}</td>
                <td className="py-2 text-right font-bold text-yellow-500 print:text-black text-xs">${(session.matchesCount * session.costPerMatch).toFixed(2)}</td>
              </tr>
              {session.drinksCount ? (
                <tr className="border-b border-yellow-500/5 print:border-stone-100">
                  <td className="py-2 capitalize font-medium text-xs">Boissons / Canettes</td>
                  <td className="py-2 text-center text-xs">{session.drinksCount}</td>
                  <td className="py-2 text-right text-xs">$0.80</td>
                  <td className="py-2 text-right font-bold text-yellow-500 print:text-black text-xs">${(session.drinksCount * 0.8).toFixed(2)}</td>
                </tr>
              ) : null}
              {session.snacksCount ? (
                <tr className="border-b border-yellow-500/5 print:border-stone-100">
                  <td className="py-2 capitalize font-medium text-xs">Snacks / Biscuits</td>
                  <td className="py-2 text-center text-xs">{session.snacksCount}</td>
                  <td className="py-2 text-right text-xs">$1.00</td>
                  <td className="py-2 text-right font-bold text-yellow-500 print:text-black text-xs">${(session.snacksCount * 1.0).toFixed(2)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Invoice Total */}
        <div className="pt-3 border-t border-dashed border-yellow-500/20 flex justify-between items-center mb-4 print:border-stone-300">
          <span className="text-base font-bold text-stone-300 print:text-black">NET À PAYER :</span>
          <span className="text-xl font-black text-yellow-500 print:text-black">${session.totalAmount.toFixed(2)}</span>
        </div>

        {/* Invoice Footer */}
        <div className="text-center space-y-2">
          <p className="text-xs text-yellow-500/70 font-medium print:text-black">Paiement Validé - Merci de votre visite !</p>
          <div className="p-2 bg-white rounded flex justify-center items-center justify-items-center mb-1 max-w-[120px] mx-auto opacity-90">
            {/* Draw clean barcode stripes */}
            <div className="h-6 w-full flex items-center justify-between gap-0.5">
              {[1,2,1,3,1,2,4,1,2,1,3,2,1,1,2,1,3,1].map((w, i) => (
                <div key={i} className="bg-black h-full" style={{ width: `${w * 1.5}px` }} />
              ))}
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 tracking-wider">NOVA-CASINO-GAMING-SYSTEM</p>
        </div>

        {/* Print Action Row - hidden on print */}
        <div className="mt-6 flex flex-col gap-2 print:hidden">
          <div className="flex gap-2">
            <button
              onClick={handleDownloadPDF}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
            >
              <Download size={14} /> Télécharger PDF
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-yellow-500 border border-yellow-500/10 font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
            >
              <Printer size={14} /> Imprimer Reçu
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-[#1c1c1c] hover:bg-zinc-800 text-zinc-400 font-semibold py-2 px-3 rounded-lg transition-colors cursor-pointer text-xs"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
