import React, { useRef, useState } from 'react';
import { Plus, Trash2, Image as ImageIcon, Sparkles, Layers, Check, RefreshCw, Camera } from 'lucide-react';

export interface VariantItem {
  type: 'Taille' | 'Couleur' | 'Modèle' | 'Capacité' | 'Option';
  options: string[];
}

const VARIANT_TYPES: VariantItem['type'][] = ['Taille', 'Couleur', 'Modèle', 'Capacité', 'Option'];

const PRESET_OPTIONS: Record<VariantItem['type'], string[]> = {
  Taille: ['S', 'M', 'L', 'XL', 'XXL'],
  Couleur: ['Noir', 'Blanc', 'Bleu', 'Rouge', 'Vert'],
  Modèle: ['Standard', 'Pro', 'Ultra', 'Plus'],
  Capacité: ['64 Go', '128 Go', '256 Go', '512 Go'],
  Option: ['Standard', 'Pack Complet', 'Avec accessoires'],
};

interface Props {
  variants: VariantItem[];
  setVariants: React.Dispatch<React.SetStateAction<VariantItem[]>>;
  variantImages: Record<string, string[]>;
  setVariantImages: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  variantStock?: Record<string, number>;
  setVariantStock?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export const VariantsManager: React.FC<Props> = ({
  variants,
  setVariants,
  variantImages,
  setVariantImages,
  variantStock,
  setVariantStock,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentTargetOption, setCurrentTargetOption] = useState<string>('');

  const handleAddVariant = (type: VariantItem['type'] = 'Taille') => {
    setVariants((prev) => [...prev, { type, options: [''] }]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTypeChange = (index: number, newType: VariantItem['type']) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, type: newType } : v))
    );
  };

  const handleAddOption = (variantIndex: number) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === variantIndex ? { ...v, options: [...v.options, ''] } : v))
    );
  };

  const handleUpdateOption = (variantIndex: number, optionIndex: number, val: string) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === variantIndex
          ? {
              ...v,
              options: v.options.map((o, j) => (j === optionIndex ? val : o)),
            }
          : v
      )
    );
  };

  const handleRemoveOption = (variantIndex: number, optionIndex: number) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === variantIndex
          ? {
              ...v,
              options: v.options.filter((_, j) => j !== optionIndex),
            }
          : v
      )
    );
  };

  const handleApplyPreset = (variantIndex: number, type: VariantItem['type']) => {
    const preset = PRESET_OPTIONS[type] || [];
    setVariants((prev) =>
      prev.map((v, i) =>
        i === variantIndex ? { ...v, type, options: [...preset] } : v
      )
    );
  };

  const triggerUploadVariantImage = (optionName: string) => {
    setCurrentTargetOption(optionName);
    fileInputRef.current?.click();
  };

  const handleSwitchVariantImages = (optionKey: string) => {
    setVariantImages((prev) => {
      const list = prev[optionKey] || [];
      if (list.length < 2) return prev;
      return {
        ...prev,
        [optionKey]: [list[1], list[0], ...list.slice(2)],
      };
    });
  };

  const handleVariantFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentTargetOption) {
      const url = URL.createObjectURL(file);
      setVariantImages((prev) => {
        const existing = [...(prev[currentTargetOption] || [])];
        return {
          ...prev,
          [currentTargetOption]: [...existing, url].slice(0, 2),
        };
      });
    }
    e.target.value = '';
  };

  return (
    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleVariantFileChange}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#FF6321]" />
          <span className="text-xs font-black text-white uppercase tracking-wider">
            Variantes (Tailles, Couleurs, Modèles)
          </span>
        </div>

        <button
          type="button"
          onClick={() => handleAddVariant('Taille')}
          className="text-[10px] text-[#FF6321] hover:underline font-bold flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ajouter une variante</span>
        </button>
      </div>

      {variants.length === 0 ? (
        <div className="py-4 text-center text-white/40 text-xs border border-dashed border-white/10 rounded-xl space-y-1">
          <p>Aucune variante configurée (article unique).</p>
          <div className="flex justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleAddVariant('Taille')}
              className="text-[10px] text-[#FF6321] font-bold px-2 py-1 bg-white/5 rounded-lg hover:bg-white/10"
            >
              + Ajouter Tailles
            </button>
            <button
              type="button"
              onClick={() => handleAddVariant('Couleur')}
              className="text-[10px] text-[#FF6321] font-bold px-2 py-1 bg-white/5 rounded-lg hover:bg-white/10"
            >
              + Ajouter Couleurs
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {variants.map((v, vIdx) => (
            <div
              key={vIdx}
              className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={v.type}
                    onChange={(e) =>
                      handleTypeChange(vIdx, e.target.value as VariantItem['type'])
                    }
                    className="p-1.5 rounded-lg bg-white/10 border border-white/10 text-xs text-white font-bold"
                  >
                    {VARIANT_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-neutral-900 text-white">
                        {t}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset(vIdx, v.type)}
                    className="text-[10px] text-[#FF6321] hover:underline font-medium flex items-center gap-0.5"
                    title="Remplir automatiquement avec les valeurs standards"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Pré-remplir</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveVariant(vIdx)}
                  className="p-1 text-white/40 hover:text-rose-400 transition"
                  title="Supprimer cette variante"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Options list */}
              <div className="space-y-1.5">
                {v.options.map((opt, oIdx) => {
                  const key = opt.trim();
                  const images = key ? variantImages[key] || [] : [];

                  return (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleUpdateOption(vIdx, oIdx, e.target.value)}
                        placeholder={`Ex: ${v.type === 'Taille' ? 'XL, 42...' : v.type === 'Couleur' ? 'Rouge, Noir...' : 'Option'}`}
                        className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                      />

                      {key && variantStock !== undefined && setVariantStock && (
                        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                          <span className="text-[9px] text-white/50">Reste :</span>
                          <input
                            type="number"
                            min="0"
                            value={variantStock[key] ?? 5}
                            onChange={(e) => {
                              const num = Math.max(0, parseInt(e.target.value) || 0);
                              setVariantStock((prev) => ({ ...prev, [key]: num }));
                            }}
                            className="w-10 text-center bg-transparent text-xs font-bold text-white focus:outline-none"
                          />
                        </div>
                      )}

                      {key && (
                        <div className="flex items-center gap-1.5 shrink-0 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
                          {images.length >= 2 ? (
                            <div className="flex items-center gap-1.5">
                              {/* Photo 1 */}
                              <div className="relative">
                                <img
                                  src={images[0]}
                                  alt={`${key} 1`}
                                  className="w-7 h-7 rounded object-cover border-2 border-emerald-400"
                                  title="Photo 1 (Active principale)"
                                />
                                <span className="absolute -top-1 -left-1 px-0.5 bg-emerald-500 text-black text-[7px] font-black rounded">
                                  1★
                                </span>
                              </div>

                              {/* Photo 2 */}
                              <div className="relative">
                                <img
                                  src={images[1]}
                                  alt={`${key} 2`}
                                  className="w-7 h-7 rounded object-cover border border-white/20 hover:border-[#FF6321] cursor-pointer opacity-80 hover:opacity-100"
                                  onClick={() => handleSwitchVariantImages(key)}
                                  title="Photo 2 (Alternative) - Cliquez pour basculer"
                                />
                                <span className="absolute -top-1 -left-1 px-0.5 bg-black/80 text-white text-[7px] font-black rounded border border-white/20">
                                  2
                                </span>
                              </div>

                              {/* Basculer vers l'autre */}
                              <button
                                type="button"
                                onClick={() => handleSwitchVariantImages(key)}
                                className="px-1.5 py-0.5 rounded bg-[#FF6321]/20 hover:bg-[#FF6321] text-[#FF6321] hover:text-white border border-[#FF6321]/40 text-[9px] font-bold flex items-center gap-1 transition active:scale-95"
                                title="Basculer vers l'autre photo"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                <span>Basculer ⇄</span>
                              </button>
                            </div>
                          ) : images.length === 1 ? (
                            <div className="flex items-center gap-1.5">
                              <div className="relative">
                                <img
                                  src={images[0]}
                                  alt={`${key} 1`}
                                  className="w-7 h-7 rounded object-cover border-2 border-emerald-400"
                                />
                                <span className="absolute -top-1 -left-1 px-0.5 bg-emerald-500 text-black text-[7px] font-black rounded">
                                  1★
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => triggerUploadVariantImage(key)}
                                className="px-1.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-[#FF6321] text-white/70 hover:text-white text-[9px] font-bold flex items-center gap-1 transition"
                                title="Ajouter la 2ème photo sur la même ligne"
                              >
                                <Plus className="w-2.5 h-2.5 text-[#FF6321]" />
                                <span>+ Photo 2</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => triggerUploadVariantImage(key)}
                              className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-bold flex items-center gap-1 transition"
                              title={`Associer une photo spécifique pour ${key}`}
                            >
                              <Camera className="w-3 h-3 text-[#FF6321]" />
                              <span>+ Photos</span>
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveOption(vIdx, oIdx)}
                        className="p-1.5 text-white/30 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => handleAddOption(vIdx)}
                className="text-[10px] text-[#FF6321] font-bold hover:underline"
              >
                + Ajouter une option {v.type}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
