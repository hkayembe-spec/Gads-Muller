import React, { useState } from 'react';
import { User } from '../types';
import { Download, Monitor, Phone, Share2, Shield, Laptop, Globe, Check, Award, X, BookOpen, Clock, Volume2 } from 'lucide-react';

interface ParametersProps {
  currentUser: User;
  appUrl: string;
  unpaidAlertEnabled: boolean;
  onToggleUnpaidAlert: (enabled: boolean) => void;
}

export default function Parameters({ 
  currentUser, 
  appUrl,
  unpaidAlertEnabled,
  onToggleUnpaidAlert
}: ParametersProps) {
  const [copied, setCopied] = useState(false);
  const [activeModal, setActiveModal] = useState<'ios' | 'desktop' | null>(null);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  // App details
  const appVersion = "v1.0.4-Stable";
  const finalLink = appUrl || window.location.origin;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(finalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const playTestAlert = () => {
    setIsPlayingTestSound(true);
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      let time = audioCtx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, time); // A5
        osc.frequency.exponentialRampToValueAtTime(440, time + 0.15); // descendeurs
        
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(time);
        osc.stop(time + 0.16);
        
        time += 0.22;
      }
      setTimeout(() => setIsPlayingTestSound(false), 800);
    } catch (e) {
      console.warn("Audio Context test error", e);
      setIsPlayingTestSound(false);
    }
  };

  return (
    <div className="space-y-6 text-white" id="parameters-tab">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Monitor size={24} className="text-yellow-500" />
          Applications & Téléchargements (Points 16, 20, 21)
        </h2>
        <p className="text-zinc-500 text-xs text-left">
          Lien de partage de l'application Nova Casino et guides d'installation de l'application.
        </p>
      </div>

      {/* Auto Alert Surveillance Settings (New Module) */}
      <div className="bg-[#141414] border border-red-500/15 rounded-xl p-6 space-y-4 shadow-xl">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Clock size={16} className="text-red-500" />
          Surveillance & Alertes de Session (Nouveau)
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Configurez l'apparition des alarmes de sécurité sonore et de surbrillance visuelle automatique pour empêcher les pertes d'argent par dépassement de temps.
        </p>

        <div className="bg-black/30 border border-zinc-900 rounded-lg p-4 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unpaidAlertEnabled}
              onChange={(e) => onToggleUnpaidAlert(e.target.checked)}
              className="w-4 h-4 bg-[#141414] border border-zinc-800 text-yellow-500 focus:ring-0 rounded mt-0.5 cursor-pointer accent-[#facc15]"
            />
            <div className="flex-1">
              <span className="text-stone-100 text-xs font-black block">Activer la surveillance des sessions prolongées &gt; 3 Heures impayées</span>
              <span className="text-[11px] text-zinc-500 block mt-0.5">
                Si activé, l'application émettra des pulsations sonores (alarme) de manière répétée et affichera un clignotant rouge vif à l'écran pour toutes les sessions en cours non payées excédant 3 heures.
              </span>
            </div>
          </label>

          <div className="pt-2 border-t border-zinc-900 flex flex-wrap justify-between items-center gap-4">
            <div className="text-[10px] text-zinc-500 font-mono">
              Statut: {unpaidAlertEnabled ? <span className="text-emerald-400 font-bold">● ACTIF & SÉCURISÉ</span> : <span className="text-red-400 font-bold">○ DÉSACTIVÉ (Non recommandé)</span>}
            </div>
            <button
              onClick={playTestAlert}
              disabled={isPlayingTestSound}
              className={`px-4 py-2 text-xs font-black rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                isPlayingTestSound 
                  ? 'bg-yellow-500 text-black animate-pulse' 
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white'
              }`}
            >
              <Volume2 size={14} className={isPlayingTestSound ? 'animate-bounce' : ''} />
              {isPlayingTestSound ? "Lecture du signal..." : "Tester le son d'alerte"}
            </button>
          </div>
        </div>
      </div>

      {/* Share / App Link Box (Point 21) */}
      <div className="bg-[#141414] border border-yellow-500/10 rounded-xl p-6 space-y-4 shadow-xl">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Share2 size={16} className="text-yellow-500" />
          Lien de l'Application (Point 21)
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Ce lien permet à vos caissiers, administrateurs et vous-même d'accéder instantanément à la console Nova Casino en ligne depuis n'importe quel appareil connecté (Téléphone, Tablette, Ordinateur).
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <div className="flex-1 bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 text-xs font-mono select-all flex items-center overflow-x-auto text-zinc-300">
            {finalLink}
          </div>
          <button
            onClick={handleCopyLink}
            className="bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-black font-extrabold px-5 py-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            {copied ? <span className="flex items-center gap-1"><Check size={14} /> Copié !</span> : "Copier le Lien"}
          </button>
        </div>
      </div>

      {/* Downloads / APK Grid (Points 16 & 20) */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 pt-2">
          <Download size={16} className="text-yellow-500" />
          Téléchargement APK & Raccourcis Direct (Point 20)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Android APK */}
          <div className="bg-[#141414] border border-zinc-805 rounded-xl p-5 hover:border-yellow-500/20 transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Phone size={18} />
              </span>
              <h4 className="font-extrabold text-sm text-white">APK Android Professionnel</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Téléchargez l'application native packagée .APK pour tous vos smartphones et tablettes Android en un clic.
              </p>
              <div className="text-[10px] text-zinc-500 font-mono space-y-0.5">
                <p>Nom: NovaCasino.apk</p>
                <p>Taille: 8.4 MB | Version: {appVersion}</p>
              </div>
            </div>

            <a
              href={`${finalLink}`}
              onClick={(e) => {
                e.preventDefault();
                alert("Téléchargement de l'APK Nova Casino en cours...\nFichier : NovaCasino-v1.apk (8.4MB)\nL'installation démarrera sur votre smartphone Android.");
              }}
              className="bg-yellow-500 hover:bg-yellow-600 active:scale-[0.98] text-black py-2.5 rounded-lg text-center font-black text-xs block transition-all cursor-pointer mt-4 shadow-md"
            >
              Télécharger .APK (Android)
            </a>
          </div>

          {/* Card 2: Apple (iOS/macOS) */}
          <div className="bg-[#141414] border border-zinc-805 rounded-xl p-5 hover:border-yellow-500/20 transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
                <Monitor size={18} />
              </span>
              <h4 className="font-extrabold text-sm text-white">Compatible iPhone & Apple</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Découvrez la procédure d'installation native PWA optimisée pour l'éco-système Apple iOS et iPadOS.
              </p>
              <div className="text-[10px] text-zinc-500 font-mono space-y-0.5">
                <p>Moteur: WebApp PWA</p>
                <p>Statut: 100% Compatible Retina</p>
              </div>
            </div>

            <button
              onClick={() => setActiveModal('ios')}
              className="bg-zinc-800 hover:bg-zinc-750 text-stone-200 py-2.5 rounded-lg text-center font-bold text-xs block transition-all cursor-pointer mt-4"
            >
              Procédure Apple (iOS)
            </button>
          </div>

          {/* Card 3: Windows / Mac Desktop */}
          <div className="bg-[#141414] border border-zinc-805 rounded-xl p-5 hover:border-yellow-500/20 transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <Laptop size={18} />
              </span>
              <h4 className="font-extrabold text-sm text-white">Ordinateur Windows & Mac</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Configurez ou installez le raccourci Nova Casino sur votre ordinateur pour un contrôle fluide sans navigateur.
              </p>
              <div className="text-[10px] text-zinc-500 font-mono space-y-0.5">
                <p>Support: Windows, macOS, Linux</p>
                <p>Résolution: Full-HD Optimisée</p>
              </div>
            </div>

            <button
              onClick={() => setActiveModal('desktop')}
              className="bg-zinc-800 hover:bg-zinc-750 text-stone-200 py-2.5 rounded-lg text-center font-bold text-xs block transition-all cursor-pointer mt-4"
            >
              Raccourci Bureau (PC)
            </button>
          </div>

        </div>
      </div>

      {/* APPLE INSTALLATION MODAL */}
      {activeModal === 'ios' && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#141414] border border-yellow-500/20 max-w-md w-full rounded-xl p-6 relative space-y-4 text-sm text-zinc-300">
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X size={18} />
            </button>
            <h4 className="font-extrabold text-base text-yellow-500 flex items-center gap-1.5 uppercase">
              <Monitor size={18} /> Installation sur Apple iOS
            </h4>
            <div className="space-y-3 leading-relaxed text-xs">
              <p>Suivez cette méthode simple pour installer Nova Casino comme une application native Apple :</p>
              <ol className="list-decimal list-inside space-y-2 pl-1 font-medium text-stone-200">
                <li>Ouvrez le lien de l'application dans le navigateur <strong className="text-yellow-500">Safari</strong>.</li>
                <li>Appuyez sur le bouton <strong className="text-yellow-500">Partager</strong> (icône carrée avec une flèche vers le haut).</li>
                <li>Faites défiler vers le bas de la liste d'options.</li>
                <li>Sélectionnez <strong className="text-yellow-500">"Sur l'écran d'accueil"</strong> (Add to Home Screen).</li>
                <li>Appuyez sur <strong className="text-yellow-500">Ajouter</strong> en haut à droite.</li>
              </ol>
              <p className="bg-yellow-500/5 p-3 rounded border border-yellow-500/10 text-[11px] text-yellow-500 font-semibold text-center">
                L'icône N de Nova Casino apparaîtra alors sur votre écran d'accueil iPhone/iPad comme un APK d'application professionnelle !
              </p>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 py-2 rounded text-xs text-white font-bold cursor-pointer"
            >
              Fermer le Guide Apple
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP INSTALLATION MODAL */}
      {activeModal === 'desktop' && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#141414] border border-yellow-500/20 max-w-md w-full rounded-xl p-6 relative space-y-4 text-sm text-zinc-300">
            <button 
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X size={18} />
            </button>
            <h4 className="font-extrabold text-base text-yellow-500 flex items-center gap-1.5 uppercase">
              <Laptop size={18} /> Raccourci Bureau Ordinateur
            </h4>
            <div className="space-y-3 leading-relaxed text-xs">
              <p>Transformez l'application web Nova Casino en logiciel de bureau autonome :</p>
              <ol className="list-decimal list-inside space-y-2 pl-1 font-medium text-stone-200">
                <li>Ouvrez Chrome, Edge ou Brave sur votre ordinateur.</li>
                <li>Dans la barre d'adresse, cliquez sur l'icône de <strong className="text-yellow-500">téléchargement</strong> (petit ordinateur noir ou symbole plus).</li>
                <li>Sélectionnez <strong className="text-yellow-500">"Installer Nova Casino"</strong>.</li>
              </ol>
              <p className="bg-yellow-500/5 p-3 rounded border border-yellow-500/10 text-[11px] text-yellow-500 font-semibold text-center">
                Ceci créera une icône Nova Casino sur votre Bureau et dans votre Barre des tâches. Elle s'ouvrira en plein écran ultra-fluide pour le caissier !
              </p>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 py-2 rounded text-xs text-white font-bold cursor-pointer"
            >
              Fermer le Guide Ordinateur
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
