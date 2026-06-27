import React, { useState } from 'react';
import { InventoryItem, User } from '../types';
import { 
  Package, 
  Plus, 
  Minus, 
  Trash2, 
  Edit, 
  PlusCircle, 
  Search, 
  MapPin, 
  AlertTriangle, 
  RotateCcw, 
  Info,
  Check,
  X,
  Folder,
  FolderArchive
} from 'lucide-react';

interface InventoryProps {
  items: InventoryItem[];
  currentUser: User;
  onAddItem: (item: Partial<InventoryItem>) => Promise<any>;
  onAdjustQty: (id: string, amount: number) => Promise<any>;
  onDeleteItem: (id: string) => Promise<any>;
  isLoading: boolean;
}

export default function Inventory({ 
  items, 
  currentUser, 
  onAddItem, 
  onAdjustQty, 
  onDeleteItem, 
  isLoading 
}: InventoryProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Manette PS5');
  const [quantity, setQuantity] = useState(0);
  const [minQuantity, setMinQuantity] = useState(2);
  const [location, setLocation] = useState('Réserve Principale');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const categoriesList = [
    "Manette PS5",
    "Manette PS4",
    "Manette PS3",
    "Câbles HDMI",
    "Cables de chargement",
    "Téléviseurs & Télé",
    "Consoles PS5",
    "Consoles PS4",
    "Consoles PS3",
    "Boissons",
    "Snacks",
    "Autre"
  ];

  const handleOpenAddModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setCategory(item.category);
      setQuantity(item.quantity);
      setMinQuantity(item.minQuantity);
      setLocation(item.location);
    } else {
      setEditingItem(null);
      setName('');
      setCategory('Manette PS5');
      setQuantity(0);
      setMinQuantity(2);
      setLocation('Réserve Principale');
    }
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Le nom de l'article est requis.");
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      await onAddItem({
        id: editingItem?.id,
        name: name.trim(),
        category,
        quantity: Number(quantity),
        minQuantity: Number(minQuantity),
        location: location.trim()
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur est survenue.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'article "${name}" de la réserve ?`)) {
      try {
        await onDeleteItem(id);
      } catch (err) {
        alert("Erreur lors de la suppression de l'article.");
      }
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.category.toLowerCase().includes(search.toLowerCase()) ||
                          item.location.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Dynamically compile categories present in items, fallback to predefined categoriesList
  const presentCategories = Array.from(new Set((items || []).map(i => i.category).filter(Boolean)));
  const mergedCategories = Array.from(new Set([...categoriesList, ...presentCategories]));

  // Group items by category for separated pocket blocks using the merged dynamic list
  const groupedItemsByPocket = mergedCategories.reduce((acc, cat) => {
    const catItems = filteredItems.filter(i => i.category === cat);
    if (catItems.length > 0) {
      acc[cat] = catItems;
    }
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  // Render individual product cards helper
  const renderItemCard = (item: InventoryItem) => {
    const isLow = item.quantity <= item.minQuantity;
    const isOut = item.quantity === 0;

    return (
      <div 
        key={item.id}
        className={`bg-[#141414] border rounded-xl overflow-hidden hover:scale-[1.01] transition-all duration-200 flex flex-col justify-between ${
          isOut 
            ? 'border-red-500/40 shadow-lg shadow-red-500/[0.03]' 
            : isLow
            ? 'border-yellow-500/40 shadow-lg shadow-yellow-500/[0.03]'
            : 'border-zinc-800/80'
        }`}
      >
        {/* Header card with status lights */}
        <div className="p-4 border-b border-zinc-800/40 space-y-2">
          <div className="flex justify-between items-start gap-2">
            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-zinc-900 text-zinc-400 border border-zinc-800">
              {item.category}
            </span>
            
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider flex items-center gap-1.5 ${
              isOut 
                ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                : isLow
                ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOut ? 'bg-red-500 animate-ping' : isLow ? 'bg-yellow-500' : 'bg-emerald-400'}`} />
              {isOut ? 'RUPTURE DE STOCK' : isLow ? 'STOCK TRÈS FAIBLE' : 'DISPONIBLE'}
            </span>
          </div>

          <div>
            <h4 className="font-extrabold text-sm text-zinc-100 leading-tight">{item.name}</h4>
            <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
              <MapPin size={11} />
              <span className="truncate">{item.location}</span>
            </div>
          </div>
        </div>

        {/* Center visual: big counter controls */}
        <div className="p-4 bg-black/20 flex items-center justify-between border-b border-zinc-800/40">
          <div className="space-y-0.5">
            <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">Quantité en Réserve</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black ${isOut ? 'text-red-500' : isLow ? 'text-yellow-500' : 'text-white'}`}>
                {item.quantity}
              </span>
              <span className="text-[10px] text-zinc-500">/ min {item.minQuantity}</span>
            </div>
          </div>

          {/* Operational adjustment controls */}
          {(currentUser.role === 'director' || currentUser.role === 'admin') ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onAdjustQty(item.id, -1)}
                disabled={item.quantity <= 0}
                className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                title="Enlever 1"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => onAdjustQty(item.id, 1)}
                className="w-8 h-8 rounded-lg bg-[#facc15] text-black hover:bg-yellow-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer font-black"
                title="Ajouter 1"
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-zinc-500 italic bg-zinc-900/40 border border-zinc-800/10 px-2 py-1 rounded">
              Manager uniquement
            </span>
          )}
        </div>

        {/* Footer bar with actions */}
        <div className="px-4 py-3 bg-[#111111]/60 flex justify-between items-center text-[10px] text-zinc-500 font-mono">
          <div className="truncate pr-2">
            Mise à jour par: <span className="text-zinc-400 font-bold">{item.updatedBy || 'Système'}</span>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {(currentUser.role === 'director' || currentUser.role === 'admin') && (
              <button
                onClick={() => handleOpenAddModal(item)}
                className="p-1.5 text-zinc-400 hover:text-yellow-400 transition-colors cursor-pointer"
                title="Modifier les détails"
              >
                <Edit size={13} />
              </button>
            )}
            {(currentUser.role === 'director' || currentUser.role === 'admin') && (
              <button
                onClick={() => handleDelete(item.id, item.name)}
                className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                title="Supprimer définitivement"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-white" id="inventory-tab">
      
      {/* Header section with Stats Cards */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <Package className="text-[#facc15] h-7 w-7" />
            Gestion des Stocks de Réserve
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Suivi en temps réel du matériel de rechange, consoles en réserve et accessoires (Manettes, Câbles, TV, etc.).
          </p>
        </div>

        {(currentUser.role === 'director' || currentUser.role === 'admin') && (
          <button
            onClick={() => handleOpenAddModal()}
            className="bg-[#facc15] text-black px-4 py-2.5 rounded-lg text-xs font-black transition-all hover:bg-yellow-400 cursor-pointer flex items-center gap-2 shadow-lg shadow-yellow-500/10 shrink-0"
          >
            <PlusCircle size={15} />
            Ajouter un article
          </button>
        )}
      </div>

      {/* Stock warning summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141414] border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-500">
            <Package size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Total Articles</span>
            <span className="text-xl font-black text-white">{items.length}</span>
          </div>
        </div>

        <div className="bg-[#141414] border border-red-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500">
            <AlertTriangle size={20} className="animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">Alertes Stock Bas</span>
            <span className="text-xl font-black text-red-500">
              {items.filter(i => i.quantity <= i.minQuantity).length}
            </span>
          </div>
        </div>

        <div className="bg-[#141414] border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
            <Check size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">En Stock Sécurisé</span>
            <span className="text-xl font-black text-emerald-400">
              {items.filter(i => i.quantity > i.minQuantity).length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar with Pocket Folders */}
      <div className="bg-[#141414] border border-zinc-800/80 rounded-xl p-4 space-y-4 shadow-xl">
        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Rechercher un article ou catégorie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-black/40 border border-zinc-800 focus:border-yellow-500 rounded-lg text-xs text-white placeholder-zinc-500 outline-none transition-colors"
            />
          </div>

          <div className="text-[10px] text-zinc-500 font-mono self-end sm:self-center">
            Affichage de {filteredItems.length} article(s)
          </div>
        </div>

        {/* Pocket tabs */}
        <div className="border-t border-zinc-850 pt-3 space-y-2">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest flex items-center gap-1.5">
            <FolderArchive size={12} className="text-yellow-500" />
            Poches de Stock séparées
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide border transition-all cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'all'
                  ? 'bg-yellow-500 border-yellow-500 text-black shadow'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              Toutes les poches ({items.length})
            </button>
            {mergedCategories.map(cat => {
              const catCount = items.filter(i => i.category === cat).length;
              if (catCount === 0 && !categoriesList.includes(cat)) return null; // Skip showing empty custom/unused categories
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide border transition-all cursor-pointer flex items-center gap-1 ${
                    selectedCategory === cat
                      ? 'bg-yellow-500 border-yellow-500 text-black shadow'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                  }`}
                >
                  {cat} ({catCount})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pocket Grid Listings */}
      {isLoading ? (
        <div className="text-center py-12 bg-[#141414] border border-zinc-800 rounded-xl text-zinc-400 animate-pulse text-xs font-black">
          Chargement du matériel en réserve...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-[#141414] border border-dashed border-zinc-800 rounded-xl space-y-3">
          <Package size={36} className="text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400 font-bold">Aucun matériel trouvé dans cette poche.</p>
          <button 
            onClick={() => handleOpenAddModal()} 
            className="text-xs font-black text-yellow-500 hover:underline cursor-pointer"
          >
            Créer un article dans cette poche
          </button>
        </div>
      ) : selectedCategory !== 'all' ? (
        // Render single pocket
        <div className="space-y-4">
          <div className="border-b border-zinc-800 pb-2 flex items-center gap-2">
            <Folder size={14} className="text-yellow-500" />
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-yellow-500">
              Poche : {selectedCategory} ({filteredItems.length} articles)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => renderItemCard(item))}
          </div>
        </div>
      ) : (
        // Render all pockets separately (Visual separation into "sa seule poche")
        <div className="space-y-8 animate-in fade-in duration-200">
          {Object.entries(groupedItemsByPocket).map(([catName, catItems]) => (
            <div key={catName} className="space-y-3.5 bg-[#141414]/30 border border-zinc-900 p-4 rounded-xl">
              <div className="border-b border-zinc-800/60 pb-2 flex justify-between items-center">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-yellow-500 flex items-center gap-2">
                  <Folder size={14} className="text-yellow-500" />
                  Poche : {catName}
                </h3>
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">
                  {catItems.length} article(s)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catItems.map(item => renderItemCard(item))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Warning banner */}
      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 flex gap-3">
        <Info size={16} className="text-yellow-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-black text-yellow-500">Niveaux de sécurité du stock</p>
          <p className="text-[11px] text-zinc-400 leading-normal">
            Lorsque la quantité de réserve passe sous le minimum de sécurité configuré, l'article apparaît automatiquement surligné en jaune ou rouge avec un clignotement pour inviter l'administrateur ou le directeur à passer commande auprès des fournisseurs agréés Nova Casino.
          </p>
        </div>
      </div>

      {/* Add / Edit Modal Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] border border-zinc-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-black/20">
              <h3 className="font-extrabold text-sm text-yellow-500 uppercase tracking-wider flex items-center gap-2">
                <Package size={16} />
                {editingItem ? "Modifier l'article" : "Ajouter un article de réserve"}
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

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 block">Nom de l'article</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Manette DualSense PS5 Blanche"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-white focus:border-yellow-500 outline-none transition-colors"
                />
              </div>

              {/* Category */}
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

              <div className="grid grid-cols-2 gap-3">
                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 block">Quantité de départ</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-white focus:border-yellow-500 outline-none transition-colors"
                  />
                </div>

                {/* Min Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 block">Stock Alerte Min.</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-white focus:border-yellow-500 outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-zinc-400 block">Lieu de stockage</label>
                <input
                  type="text"
                  placeholder="Ex: Armoire Réserve A, Tiroir 3"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-white focus:border-yellow-500 outline-none transition-colors"
                />
              </div>

              {/* Submit Actions */}
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
                  {isSaving ? "Enregistrement..." : editingItem ? "Mettre à jour" : "Ajouter au stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
