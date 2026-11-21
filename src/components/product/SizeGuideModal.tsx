import React, { useState } from 'react';
import { X, Ruler, Check, Sparkles, HelpCircle, ChevronRight, Info } from 'lucide-react';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  category?: string;
  options?: string[];
  selectedSize?: string;
  onSelectSize?: (size: string) => void;
  variantImages?: Record<string, string[]>;
}

interface SizeMeasurement {
  size: string;
  eu: string;
  chest: string; // Poitrine
  waist: string; // Tour de taille
  hips: string;  // Hanches
  length: string; // Longueur
  desc: string;
  photo: string;
}

const DEFAULT_CLOTHING_MEASUREMENTS: Record<string, SizeMeasurement> = {
  'S': {
    size: 'S',
    eu: '36 - 38',
    chest: '84 - 88 cm',
    waist: '64 - 68 cm',
    hips: '90 - 94 cm',
    length: '105 cm',
    desc: 'Coupe cintrée près du corps, idéale pour silhouette fine',
    photo: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600'
  },
  'M': {
    size: 'M',
    eu: '38 - 40',
    chest: '88 - 94 cm',
    waist: '68 - 74 cm',
    hips: '94 - 100 cm',
    length: '107 cm',
    desc: 'Taille standard équilibrée, confort et élégance au quotidien',
    photo: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'
  },
  'L': {
    size: 'L',
    eu: '40 - 42',
    chest: '94 - 102 cm',
    waist: '74 - 82 cm',
    hips: '100 - 108 cm',
    length: '110 cm',
    desc: 'Coupe aisée et fluide, liberté de mouvement optimale',
    photo: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600'
  },
  'XL': {
    size: 'XL',
    eu: '44 - 46',
    chest: '102 - 110 cm',
    waist: '82 - 90 cm',
    hips: '108 - 116 cm',
    length: '112 cm',
    desc: 'Coupe généreuse et flatteuse, confort absolu',
    photo: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600'
  },
  'XXL': {
    size: 'XXL',
    eu: '46 - 48',
    chest: '110 - 118 cm',
    waist: '90 - 98 cm',
    hips: '116 - 124 cm',
    length: '114 cm',
    desc: 'Coupe ample grand confort',
    photo: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600'
  }
};

const DEFAULT_SHOE_MEASUREMENTS: Record<string, { size: string; footLength: string; width: string; photo: string }> = {
  '39': { size: '39', footLength: '24.5 cm', width: 'Standard', photo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300' },
  '40': { size: '40', footLength: '25.0 cm', width: 'Standard', photo: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=300' },
  '41': { size: '41', footLength: '25.5 cm', width: 'Standard', photo: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=300' },
  '42': { size: '42', footLength: '26.0 cm', width: 'Standard / Confort', photo: 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=300' },
  '43': { size: '43', footLength: '26.8 cm', width: 'Confort', photo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300' },
  '44': { size: '44', footLength: '27.5 cm', width: 'Large', photo: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=300' },
  '45': { size: '45', footLength: '28.2 cm', width: 'Grand Confort', photo: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300' },
};

export const SizeGuideModal: React.FC<SizeGuideModalProps> = ({
  isOpen,
  onClose,
  productName,
  category = 'Mode',
  options = ['S', 'M', 'L', 'XL'],
  selectedSize,
  onSelectSize,
  variantImages = {}
}) => {
  const [activeTab, setActiveTab] = useState<'photos' | 'table' | 'advice'>('photos');
  const [inspectedSize, setInspectedSize] = useState<string>(selectedSize || options[0] || 'M');

  if (!isOpen) return null;

  const isShoe = category.toLowerCase().includes('chaussure') || 
    options.some((o) => ['38', '39', '40', '41', '42', '43', '44', '45'].includes(o));

  const currentPhoto = variantImages[inspectedSize]?.[0] || 
    (isShoe ? DEFAULT_SHOE_MEASUREMENTS[inspectedSize]?.photo : DEFAULT_CLOTHING_MEASUREMENTS[inspectedSize]?.photo) ||
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-neutral-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6321]/15 border border-[#FF6321]/30 flex items-center justify-center text-[#FF6321]">
              <Ruler className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Photo & Guide des tailles</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF6321] text-white">
                  Officiel
                </span>
              </h2>
              <p className="text-xs text-white/50 truncate max-w-[280px] sm:max-w-sm">
                {productName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS */}
        <div className="px-4 pt-3 flex gap-2 border-b border-white/10 bg-black/30">
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'photos'
                ? 'border-[#FF6321] text-[#FF6321]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span>Photos par taille</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">
              {options.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'table'
                ? 'border-[#FF6321] text-[#FF6321]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span>Tableau des mesures</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('advice')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'advice'
                ? 'border-[#FF6321] text-[#FF6321]'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span>Conseils morpho</span>
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-4 sm:p-5 overflow-y-auto no-scrollbar space-y-4 flex-1">
          {activeTab === 'photos' && (
            <div className="space-y-4">
              {/* CURRENT PHOTO SPOTLIGHT */}
              <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-2xl overflow-hidden bg-black/60 border border-white/10">
                <img
                  src={currentPhoto}
                  alt={`Taille ${inspectedSize}`}
                  className="w-full h-full object-cover transition-all duration-300"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-[#FF6321] text-white text-xs font-black shadow-lg">
                    Taille {inspectedSize}
                  </span>
                  {!isShoe && DEFAULT_CLOTHING_MEASUREMENTS[inspectedSize] && (
                    <span className="px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-bold">
                      FR/EU {DEFAULT_CLOTHING_MEASUREMENTS[inspectedSize].eu}
                    </span>
                  )}
                  {isShoe && DEFAULT_SHOE_MEASUREMENTS[inspectedSize] && (
                    <span className="px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-bold">
                      Pied : {DEFAULT_SHOE_MEASUREMENTS[inspectedSize].footLength}
                    </span>
                  )}
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                  <p className="font-semibold text-white/90 drop-shadow truncate pr-2">
                    {!isShoe 
                      ? (DEFAULT_CLOTHING_MEASUREMENTS[inspectedSize]?.desc || `Coupe pour taille ${inspectedSize}`)
                      : (DEFAULT_SHOE_MEASUREMENTS[inspectedSize] ? `Largeur : ${DEFAULT_SHOE_MEASUREMENTS[inspectedSize].width}` : `Pointure ${inspectedSize}`)}
                  </p>

                  {onSelectSize && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSize(inspectedSize);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#FF6321] hover:bg-[#e05316] text-white font-black text-xs shrink-0 shadow-lg active:scale-95 transition flex items-center gap-1.5"
                    >
                      {selectedSize === inspectedSize ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Sélectionnée</span>
                        </>
                      ) : (
                        <span>Choisir cette taille</span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* THUMBNAIL LIST OF SIZES */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-white/80 block">
                  Cliquez sur une taille pour afficher sa photo :
                </span>

                <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5">
                  {Array.from(new Set(options)).map((opt, optIdx) => {
                    const isInspected = inspectedSize === opt;
                    const isSelected = selectedSize === opt;
                    const optPhoto = variantImages[opt]?.[0] || 
                      (isShoe ? DEFAULT_SHOE_MEASUREMENTS[opt]?.photo : DEFAULT_CLOTHING_MEASUREMENTS[opt]?.photo) ||
                      'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600';

                    return (
                      <button
                        key={`sg-opt-${opt}-${optIdx}`}
                        type="button"
                        onClick={() => setInspectedSize(opt)}
                        className={`p-1.5 rounded-2xl border transition-all flex flex-col items-center gap-1 relative text-center group active:scale-95 ${
                          isInspected
                            ? 'border-[#FF6321] bg-[#FF6321]/15 text-white ring-2 ring-[#FF6321]/60 shadow-lg shadow-orange-600/20'
                            : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-neutral-900 border border-white/10">
                          <img
                            src={optPhoto}
                            alt={`Taille ${opt}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-black ${
                            isInspected ? 'bg-[#FF6321] text-white' : 'bg-black/80 text-white border border-white/20'
                          }`}>
                            {opt}
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#FF6321] text-white flex items-center justify-center shadow">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-extrabold truncate w-full text-center">
                          {isShoe ? `P. ${opt}` : `Taille ${opt}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'table' && (
            <div className="space-y-4">
              {!isShoe ? (
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full text-left text-xs text-white">
                    <thead className="bg-white/10 text-white/70 text-[10px] uppercase font-black">
                      <tr>
                        <th className="p-3">Taille</th>
                        <th className="p-3">FR/EU</th>
                        <th className="p-3">Poitrine</th>
                        <th className="p-3">Taille</th>
                        <th className="p-3">Hanches</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-white/[0.02]">
                      {Array.from(new Set(options)).map((opt, optIdx) => {
                        const m = DEFAULT_CLOTHING_MEASUREMENTS[opt] || {
                          size: opt,
                          eu: 'Standard',
                          chest: '88-96 cm',
                          waist: '70-78 cm',
                          hips: '94-102 cm',
                          length: '108 cm',
                          desc: '',
                          photo: ''
                        };
                        const isCurrent = selectedSize === opt;

                        return (
                          <tr key={`sg-tr-${opt}-${optIdx}`} className={`hover:bg-white/5 transition ${isCurrent ? 'bg-[#FF6321]/10 font-bold' : ''}`}>
                            <td className="p-3 font-black text-[#FF6321] flex items-center gap-1.5">
                              <span>{opt}</span>
                              {isCurrent && <Check className="w-3 h-3 text-[#FF6321]" />}
                            </td>
                            <td className="p-3 text-white/80">{m.eu}</td>
                            <td className="p-3 text-white/70">{m.chest}</td>
                            <td className="p-3 text-white/70">{m.waist}</td>
                            <td className="p-3 text-white/70">{m.hips}</td>
                            <td className="p-3">
                              {onSelectSize && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectSize(opt);
                                    onClose();
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${
                                    isCurrent
                                      ? 'bg-[#FF6321] text-white'
                                      : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
                                  }`}
                                >
                                  {isCurrent ? 'Actuelle' : 'Choisir'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full text-left text-xs text-white">
                    <thead className="bg-white/10 text-white/70 text-[10px] uppercase font-black">
                      <tr>
                        <th className="p-3">Pointure</th>
                        <th className="p-3">Longueur du pied</th>
                        <th className="p-3">Largeur chaussant</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 bg-white/[0.02]">
                      {Array.from(new Set(options)).map((opt, optIdx) => {
                        const m = DEFAULT_SHOE_MEASUREMENTS[opt] || {
                          size: opt,
                          footLength: '26 cm',
                          width: 'Standard',
                          photo: ''
                        };
                        const isCurrent = selectedSize === opt;

                        return (
                          <tr key={`sg-shoe-${opt}-${optIdx}`} className={`hover:bg-white/5 transition ${isCurrent ? 'bg-[#FF6321]/10 font-bold' : ''}`}>
                            <td className="p-3 font-black text-[#FF6321]">{opt}</td>
                            <td className="p-3 text-white/80">{m.footLength}</td>
                            <td className="p-3 text-white/70">{m.width}</td>
                            <td className="p-3">
                              {onSelectSize && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectSize(opt);
                                    onClose();
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition ${
                                    isCurrent
                                      ? 'bg-[#FF6321] text-white'
                                      : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
                                  }`}
                                >
                                  {isCurrent ? 'Actuelle' : 'Choisir'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-[11px] text-white/60 flex items-start gap-2">
                <Info className="w-4 h-4 text-[#FF6321] shrink-0 mt-0.5" />
                <span>
                  Toutes les mesures sont indiquées en centimètres. Pour les vêtements en Wax 100% coton authentique, nous prévoyons une aisance naturelle de 2 à 3 cm pour un tombé parfait.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'advice' && (
            <div className="space-y-3 text-xs text-white/80">
              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-white font-black text-sm">
                  <Sparkles className="w-4 h-4 text-[#FF6321]" />
                  <span>Comment bien choisir votre taille ?</span>
                </div>
                <p className="text-white/60 leading-relaxed text-[11px]">
                  Nos vêtements en pagne Wax et tissus d'Adjamé sont confectionnés selon les standards anatomiques ivoiriens et africains :
                </p>
                <ul className="space-y-1.5 text-[11px] list-disc pl-4 text-white/70">
                  <li><strong>Entre deux tailles ?</strong> Nous vous conseillons de privilégier la taille supérieure pour plus d'aisance et de confort.</li>
                  <li><strong>Coupe cintrée :</strong> Si vous préférez un effet ajusté près du buste, optez pour votre taille habituelle en prêt-à-porter.</li>
                  <li><strong>Chaussures et mocassins :</strong> Le cuir souple prend la forme exacte de votre pied dès les 2 premiers jours de port.</li>
                </ul>
              </div>

              <div className="p-3.5 bg-gradient-to-r from-[#FF6321]/15 to-transparent rounded-2xl border border-[#FF6321]/20 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-white text-xs">Un doute avant de commander ?</h4>
                  <p className="text-[10px] text-white/60">Discutez directement avec le tailleur ou le vendeur en un clic.</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl bg-[#FF6321] text-white text-xs font-bold shrink-0 hover:bg-[#e05316] transition active:scale-95"
                >
                  OK compris
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <div className="text-xs text-white/60">
            Taille active : <strong className="text-[#FF6321] font-black">{selectedSize || inspectedSize}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition active:scale-95"
            >
              Fermer
            </button>
            {onSelectSize && (
              <button
                type="button"
                onClick={() => {
                  onSelectSize(inspectedSize);
                  onClose();
                }}
                className="px-5 py-2 rounded-xl bg-[#FF6321] hover:bg-[#e05316] text-white text-xs font-black shadow-lg shadow-orange-600/30 transition active:scale-95 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Valider {inspectedSize}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
