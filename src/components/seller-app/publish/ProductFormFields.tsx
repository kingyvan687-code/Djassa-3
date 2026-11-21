import React from 'react';
import { Tag, MapPin, Layers, Percent, FileText, Hash } from 'lucide-react';
import { formatFCFA } from '../../../services/marketServices';

interface Props {
  name: string;
  setName: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  originalPrice: string;
  setOriginalPrice: (v: string) => void;
  stock: string;
  setStock: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  tags: string[];
  setTags: (v: string[]) => void;
}

export const CATEGORIES = [
  'Mode & Vêtements',
  'Chaussures & Baskets',
  'Électronique',
  'Informatique & Téléphonie',
  'Beauté & Cosmétiques',
  'Bijoux & Montres',
  'Maison & Déco',
  'Sport & Fitness',
  'Enfants & Bébés',
  'Alimentation & Épices',
  'Auto & Moto',
];

const SUGGESTED_TAGS = [
  '#Nouveauté',
  '#QualitéGarantie',
  '#PromoAdjamé',
  '#100%Original',
  '#StockLimité',
  '#LivraisonRapide',
  '#Tendance',
];

export const ProductFormFields: React.FC<Props> = ({
  name,
  setName,
  price,
  setPrice,
  originalPrice,
  setOriginalPrice,
  stock,
  setStock,
  category,
  setCategory,
  location,
  setLocation,
  description,
  setDescription,
  tags,
  setTags,
}) => {
  const numPrice = Number(price) || 0;
  const numOriginal = Number(originalPrice) || 0;
  const discountPercent = numOriginal > numPrice && numPrice > 0
    ? Math.round(((numOriginal - numPrice) / numOriginal) * 100)
    : 0;

  const toggleTag = (t: string) => {
    if (tags.includes(t)) {
      setTags(tags.filter((x) => x !== t));
    } else {
      setTags([...tags, t]);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Titre du produit */}
      <div>
        <label className="text-[11px] font-bold text-white/80 block mb-1">
          Nom ou Titre de l'article *
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Pagne Vlisco Woodin, Chemise Lin Homme, Baskets Air Force..."
          className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
        />
      </div>

      {/* 2. Catégorie & Localisation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] font-bold text-white/80 block mb-1">
            Catégorie du produit *
          </label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-3 rounded-2xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-white/80 block mb-1">
            Emplacement / Magasin
          </label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Marché Black d'Adjamé, Box 14"
              className="w-full p-3 pl-10 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
            />
          </div>
        </div>
      </div>

      {/* 3. Tarification & Stock */}
      <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
        <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block">
          Tarification & Stock en Magasin
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="text-[10px] font-bold text-white/80 block mb-1">
              Prix de vente (FCFA) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Ex: 15000"
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
            />
            {numPrice > 0 && (
              <span className="text-[10px] text-[#FF6321] font-bold block mt-1">
                {formatFCFA(numPrice)}
              </span>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-white/80 block mb-1">
              Ancien prix barré (optionnel)
            </label>
            <input
              type="number"
              min="0"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              placeholder="Ex: 18000"
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
            />
            {discountPercent > 0 && (
              <span className="text-[10px] text-emerald-400 font-bold block mt-1">
                Remise de -{discountPercent}%
              </span>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-white/80 block mb-1">
              Quantité en Stock *
            </label>
            <input
              type="number"
              min="0"
              required
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="Ex: 25"
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
            />
            <span className="text-[10px] text-white/40 block mt-1">
              {Number(stock) > 0 ? `${stock} unités disponibles` : 'Rupture si 0'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Description & Arguments de vente */}
      <div>
        <label className="text-[11px] font-bold text-white/80 block mb-1">
          Description & Détails de l'article
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Matière, origine, conseils d'utilisation, état neuf sous emballage, garantie..."
          className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321] no-scrollbar"
        />
      </div>

      {/* 5. Hashtags suggérés */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold text-white/50 block">
          Mots-clés / Hashtags de visibilité dans le fil d'Adjamé :
        </span>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_TAGS.map((t) => {
            const isSelected = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                  isSelected
                    ? 'bg-[#FF6321] text-white'
                    : 'bg-white/5 hover:bg-white/10 text-white/60'
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
