import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Check,
  Search,
  Sparkles,
  Layers,
  ChevronRight,
  TrendingUp,
  Tag,
  ArrowRight,
  CheckCircle2,
  Info,
  Plus,
  Trash2,
  FolderPlus,
  Smile,
} from 'lucide-react';

export interface CategoryData {
  id: string;
  name: string;
  icon: string;
  badge: string;
  badgeColor: string;
  description: string;
  subcategories: string[];
  popularTags: string[];
  stats: string;
  isCustom?: boolean;
}

const CUSTOM_CATEGORIES_KEY = 'adjamemarket_custom_categories';

export const getStoredCustomCategories = (): CategoryData[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading custom categories', e);
  }
  return [];
};

export const getCategoryIconHelper = (catName: string): string => {
  if (!catName) return '👗';
  const custom = getStoredCustomCategories();
  const all = [...custom, ...CATEGORIES_CATALOG];
  const found = all.find(
    (c) => c.name.toLowerCase().trim() === catName.toLowerCase().trim()
  );
  return found?.icon || '📦';
};

export const CATEGORIES_CATALOG: CategoryData[] = [
  {
    id: 'mode_vetements',
    name: 'Mode & Vêtements',
    icon: '👗',
    badge: '🔥 Top Ventes Adjamé',
    badgeColor: 'bg-[#FF6321]/20 text-[#FF6321] border-[#FF6321]/30',
    description: "Pagnes Woodin/Vlisco, chemises lin, robes de soirée, boubous, jeans et tenues décontractées.",
    subcategories: [
      'Pagne & Tissus Wax',
      'Robes & Combinaisons',
      'Chemises & Lin Homme',
      'Pantalons & Jeans',
      'Costumes & Vestes',
      'T-shirts & Polos',
      'Ensembles Traditionnels & Boubous',
      'Lingerie & Nuit',
    ],
    popularTags: ['#ModeAbidjan', '#PagneVlisco', '#Chic', '#LinAfricain'],
    stats: '+3 400 recherches quotidiennes',
  },
  {
    id: 'chaussures_baskets',
    name: 'Chaussures & Baskets',
    icon: '👟',
    badge: '⚡ Très Recherché',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Sneakers tendance, baskets de sport, mocassins en cuir, sandales et talons habillés.',
    subcategories: [
      'Baskets & Sneakers',
      'Sandales & Claquettes Cuir',
      'Mocassins & Souliers Ville',
      'Escarpins & Talons Soirée',
      'Bottes & Bottines',
      'Chaussures de Sport / Foot',
    ],
    popularTags: ['#SneakersCI', '#BasketsAbidjan', '#AirForce', '#StyleCuir'],
    stats: '+2 800 recherches quotidiennes',
  },
  {
    id: 'informatique_telephonie',
    name: 'Informatique & Téléphonie',
    icon: '📱',
    badge: '🚀 Forte Demande',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    description: 'Smartphones neufs & reconditionnés, PC portables, tablettes, coques et chargeurs rapides.',
    subcategories: [
      'Smartphones (iPhone, Samsung...)',
      'PC Portables & Bureautique',
      'Tablettes & iPads',
      'Chargeurs, Câbles & Powerbanks',
      'Coques & Protections écran',
      'AirPods & Écouteurs sans fil',
    ],
    popularTags: ['#iPhoneAbidjan', '#TechCI', '#BonsPlansTech'],
    stats: '+4 100 recherches quotidiennes',
  },
  {
    id: 'electronique_gadgets',
    name: 'Électronique & Gadgets',
    icon: '🎧',
    badge: '💎 Gadgets Tendance',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    description: 'Enceintes Bluetooth, montres connectées, casques audio sans fil et accessoires multimédia.',
    subcategories: [
      'Enceintes Bluetooth Nomades',
      'Montres Connectées / Smartwatch',
      'Casques & Écouteurs Audio',
      'Accessoires Gaming & Consoles',
      'Drones & Caméras Portatives',
      'Câbles HDMI & Convertisseurs',
    ],
    popularTags: ['#GadgetsAdjamé', '#Bluetooth', '#Smartwatch'],
    stats: '+1 900 recherches quotidiennes',
  },
  {
    id: 'beaute_cosmetiques',
    name: 'Beauté & Cosmétiques',
    icon: '💄',
    badge: '✨ Tendance Beauté',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    description: 'Parfums de luxe, mèches brésiliennes, perruques, soins visage, crèmes et maquillage.',
    subcategories: [
      'Parfums & Brumes de Corps',
      'Mèches, Tissages & Perruques',
      'Soins Visage & Corps',
      'Maquillage & Rouges à lèvres',
      'Soins Capillaires & Huiles',
      'Savons Naturels & Karité',
    ],
    popularTags: ['#BeautéIvoirienne', '#ParfumsAbidjan', '#PerruquesHD'],
    stats: '+2 500 recherches quotidiennes',
  },
  {
    id: 'bijoux_montres',
    name: 'Bijoux & Montres',
    icon: '⌚',
    badge: '👑 Élégance & Luxe',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    description: 'Montres habillées homme/femme, chaînes gourmettes, bagues, bracelets et parures dorées.',
    subcategories: [
      'Montres Luxe & Chronographes',
      'Chaînes & Colliers Plaqué Or',
      'Bracelets & Gourmettes',
      'Bagues & Alliances',
      'Boucles d’oreilles & Créoles',
      'Parures complètes de fête',
    ],
    popularTags: ['#MontresAbidjan', '#BijouxChic', '#PlaquéOr'],
    stats: '+1 400 recherches quotidiennes',
  },
  {
    id: 'meubles_mobilier',
    name: 'Meubles & Mobilier',
    icon: '🛋️',
    badge: '🪑 Aménagement Salon',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    description: 'Canapés, tables basses, fauteuils, armoires, lits, commodes et mobilier artisanal d’Adjamé.',
    subcategories: [
      'Canapés & Salons',
      'Tables Basses & Repas',
      'Lits & Matelas',
      'Armoires & Commodes',
      'Chaises & Tabourets',
      'Meubles TV & Étagères',
    ],
    popularTags: ['#MeublesAbidjan', '#CanapéSalon', '#BoisMassif'],
    stats: '+1 700 recherches quotidiennes',
  },
  {
    id: 'menage_entretien',
    name: 'Ménage & Entretien',
    icon: '🧼',
    badge: '✨ Maison Impeccable',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    description: 'Balais magiques essoreurs, serpillières, détergents pro, lessives, désinfectants et éponges.',
    subcategories: [
      'Balais & Serpillières Essoreuses',
      'Produits de Nettoyage & Dégraissants',
      'Lessives & Assouplissants',
      'Éponges, Chiffons & Microfibres',
      'Désodorisants & Parfums d’ambiance',
      'Bacs & Poubelles de Rangement',
    ],
    popularTags: ['#MénageExpress', '#NettoyageMaison', '#Propreté'],
    stats: '+1 500 recherches quotidiennes',
  },
  {
    id: 'maison_deco',
    name: 'Maison & Déco',
    icon: '🛋️',
    badge: '🏡 Essentiels Maison',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    description: 'Draps satin/coton, rideaux, vaisselle, ustensiles de cuisine et petit électroménager.',
    subcategories: [
      'Draps & Parures de Lit',
      'Rideaux & Voilages',
      'Ustensiles & Vaisselle Cuisine',
      'Petits Électroménagers (Mixeurs, Airfryer...)',
      'Décoration & Tapis de Salon',
      'Rangement & Organisation',
    ],
    popularTags: ['#MaisonAbidjan', '#DécoIntérieur', '#DrapsQualité'],
    stats: '+1 800 recherches quotidiennes',
  },
  {
    id: 'sport_fitness',
    name: 'Sport & Fitness',
    icon: '⚽',
    badge: '🏆 Passion Sport',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    description: 'Maillots de football clubs/sélections, tenues de fitness, haltères et baskets de running.',
    subcategories: [
      'Maillots de Football Officiels',
      'Tenues Fitness & Leggings',
      'Haltères & Bandes Élastiques',
      'Gourdes Sport & Shakers',
      'Baskets de Course / Running',
      'Sacs de Sport & Accessoires',
    ],
    popularTags: ['#MaillotsCI', '#FitnessAbidjan', '#Team225'],
    stats: '+1 600 recherches quotidiennes',
  },
  {
    id: 'enfants_bebes',
    name: 'Enfants & Bébés',
    icon: '👶',
    badge: '🍼 Univers Enfant',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    description: 'Habits bébé, layettes de maternité, chaussures enfants, jouets d’éveil et puériculture.',
    subcategories: [
      'Layettes & Vêtements Naissance',
      'Robes & Ensembles Fille',
      'Chemises & Ensembles Garçon',
      'Chaussures Bébés & Enfants',
      'Poussettes & Porte-bébés',
      'Jouets d’éveil & Éducatifs',
    ],
    popularTags: ['#BébéAdjamé', '#MaternitéCI', '#EnfantsChic'],
    stats: '+1 200 recherches quotidiennes',
  },
  {
    id: 'alimentation_epices',
    name: 'Alimentation & Épices',
    icon: '🌶️',
    badge: '🌿 Terroir Local',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    description: 'Épices de cuisine ivoirienne, assaisonnements, huiles végétales pures et thés détox.',
    subcategories: [
      'Épices & Assaisonnements Locaux',
      'Huile de Palme & Beurre de Karité',
      'Vivriers Séchés & Piments',
      'Chocolats, Pâtes & Goûters',
      'Thés Détox & Infusions Santé',
      'Jus de Fruits Naturels Pressés',
    ],
    popularTags: ['#SaveursAdjamé', '#ÉpicesLocales', '#Terroir225'],
    stats: '+950 recherches quotidiennes',
  },
  {
    id: 'auto_moto',
    name: 'Auto & Moto',
    icon: '🏍️',
    badge: '🔧 Mobilité & Moto',
    badgeColor: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    description: 'Casques moto homologués, gants, supports smartphone, ampoules LED et accessoires auto.',
    subcategories: [
      'Casques Moto & Protections',
      'Supports Téléphone & Chargeurs Auto',
      'Ampoules LED & Projecteurs',
      'Produits Entretien & Lustrage',
      'Housses de Sièges & Tapis Auto',
      'Pièces d’usure moto & cyclomoteur',
    ],
    popularTags: ['#MotoAbidjan', '#AutoAccessoires', '#SécuritéRoute'],
    stats: '+800 recherches quotidiennes',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentCategory: string;
  productName?: string;
  onSelectCategory: (categoryName: string, subcategoryName?: string) => void;
}

export const CategorySelectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentCategory,
  productName = '',
  onSelectCategory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryName, setSelectedCategoryName] = useState(currentCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  // Custom categories state
  const [customCategories, setCustomCategories] = useState<CategoryData[]>(() => getStoredCustomCategories());
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Creation form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🏷️');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [newCatSubcategories, setNewCatSubcategories] = useState<string[]>([]);
  const [tempSubcatInput, setTempSubcatInput] = useState('');

  // Inline subcategory addition for existing categories
  const [inlineSubcatCatId, setInlineSubcatCatId] = useState<string | null>(null);
  const [inlineSubcatInput, setInlineSubcatInput] = useState('');

  const PRESET_EMOJIS = [
    '👗', '👟', '📱', '🎧', '💄', '⌚',
    '🏠', '⚽', '👶', '🌶️', '🏍️', '🎨',
    '🧵', '🌿', '📦', '💍', '👜', '👓',
    '🧴', '🎁', '🥖', '✂️', '💎', '🏷️',
  ];

  const saveCustomCategories = (updated: CategoryData[]) => {
    setCustomCategories(updated);
    try {
      localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving custom categories', e);
    }
  };

  // Sync when opening
  useEffect(() => {
    if (isOpen) {
      setCustomCategories(getStoredCustomCategories());
      setSelectedCategoryName(currentCategory || 'Mode & Vêtements');
      setSelectedSubcategory(null);
      setSearchQuery('');
      setIsCreatingCategory(false);
      setInlineSubcatCatId(null);
    }
  }, [isOpen, currentCategory]);

  const allCategories = useMemo(() => {
    // Custom categories come first so they are immediately visible
    const existingCustomNames = new Set(customCategories.map((c) => c.name.toLowerCase()));
    const remainingDefaults = CATEGORIES_CATALOG.filter(
      (c) => !existingCustomNames.has(c.name.toLowerCase())
    );
    return [...customCategories, ...remainingDefaults];
  }, [customCategories]);

  // Smart suggestion detection based on product name
  const suggestedCategory = useMemo(() => {
    if (!productName || productName.trim().length < 2) return null;
    const lower = productName.toLowerCase();

    if (lower.includes('basket') || lower.includes('chaussur') || lower.includes('air force') || lower.includes('sneaker') || lower.includes('nike') || lower.includes('jordan') || lower.includes('moccasin') || lower.includes('sandale') || lower.includes('talon')) {
      return allCategories.find((c) => c.id === 'chaussures_baskets') || null;
    }
    if (lower.includes('pagne') || lower.includes('robe') || lower.includes('chemise') || lower.includes('lin') || lower.includes('t-shirt') || lower.includes('jean') || lower.includes('costume') || lower.includes('boubou') || lower.includes('pantalon')) {
      return allCategories.find((c) => c.id === 'mode_vetements') || null;
    }
    if (lower.includes('iphone') || lower.includes('samsung') || lower.includes('téléphone') || lower.includes('portable') || lower.includes('laptop') || lower.includes('macbook') || lower.includes('coque') || lower.includes('airpod')) {
      return allCategories.find((c) => c.id === 'informatique_telephonie') || null;
    }
    if (lower.includes('enceinte') || lower.includes('bluetooth') || lower.includes('montre connectée') || lower.includes('smartwatch') || lower.includes('casque') || lower.includes('écouteur')) {
      return allCategories.find((c) => c.id === 'electronique_gadgets') || null;
    }
    if (lower.includes('parfum') || lower.includes('mèche') || lower.includes('perruque') || lower.includes('lait') || lower.includes('savon') || lower.includes('crème') || lower.includes('gloss') || lower.includes('rouge à lèvre')) {
      return allCategories.find((c) => c.id === 'beaute_cosmetiques') || null;
    }
    if (lower.includes('montre') || lower.includes('chaîne') || lower.includes('collier') || lower.includes('bague') || lower.includes('bracelet') || lower.includes('gourmette')) {
      return allCategories.find((c) => c.id === 'bijoux_montres') || null;
    }
    if (lower.includes('drap') || lower.includes('rideau') || lower.includes('cuisine') || lower.includes('mixeur') || lower.includes('salon') || lower.includes('lit')) {
      return allCategories.find((c) => c.id === 'maison_deco') || null;
    }
    if (lower.includes('maillot') || lower.includes('sport') || lower.includes('fitness') || lower.includes('muscu') || lower.includes('football') || lower.includes('running')) {
      return allCategories.find((c) => c.id === 'sport_fitness') || null;
    }
    if (lower.includes('bébé') || lower.includes('enfant') || lower.includes('jouet') || lower.includes('poussette') || lower.includes('naissance')) {
      return allCategories.find((c) => c.id === 'enfants_bebes') || null;
    }
    if (lower.includes('épice') || lower.includes('assaisonnement') || lower.includes('huile') || lower.includes('piment') || lower.includes('thé')) {
      return allCategories.find((c) => c.id === 'alimentation_epices') || null;
    }
    if (lower.includes('moto') || lower.includes('auto') || lower.includes('voiture') || lower.includes('casque moto')) {
      return allCategories.find((c) => c.id === 'auto_moto') || null;
    }
    return null;
  }, [productName, allCategories]);

  // Filtered categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return allCategories;
    const q = searchQuery.toLowerCase().trim();
    return allCategories.filter((cat) => {
      const matchName = cat.name.toLowerCase().includes(q);
      const matchDesc = cat.description.toLowerCase().includes(q);
      const matchSub = cat.subcategories.some((s) => s.toLowerCase().includes(q));
      const matchTags = cat.popularTags.some((t) => t.toLowerCase().includes(q));
      return matchName || matchDesc || matchSub || matchTags;
    });
  }, [searchQuery, allCategories]);

  if (!isOpen) return null;

  const currentCategoryData =
    allCategories.find((c) => c.name === selectedCategoryName) || allCategories[0];

  const handleApply = () => {
    onSelectCategory(selectedCategoryName, selectedSubcategory || undefined);
    onClose();
  };

  const handleSelectSub = (sub: string) => {
    if (selectedSubcategory === sub) {
      setSelectedSubcategory(null);
    } else {
      setSelectedSubcategory(sub);
    }
  };

  const handleAddTempSubcategory = () => {
    const trimmed = tempSubcatInput.trim();
    if (trimmed && !newCatSubcategories.includes(trimmed)) {
      setNewCatSubcategories([...newCatSubcategories, trimmed]);
      setTempSubcatInput('');
    }
  };

  const handleRemoveTempSubcategory = (index: number) => {
    setNewCatSubcategories(newCatSubcategories.filter((_, i) => i !== index));
  };

  const handleCreateCategorySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = newCatName.trim();
    if (!trimmedName) return;

    // Check if category name already exists
    const existing = allCategories.find(
      (c) => c.name.toLowerCase().trim() === trimmedName.toLowerCase()
    );
    if (existing) {
      setSelectedCategoryName(existing.name);
      if (newCatSubcategories.length > 0) {
        setSelectedSubcategory(newCatSubcategories[0]);
      }
      setIsCreatingCategory(false);
      return;
    }

    const createdCat: CategoryData = {
      id: `custom_${Date.now()}`,
      name: trimmedName,
      icon: newCatIcon || '🏷️',
      badge: '✨ Ma Catégorie',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      description:
        newCatDescription.trim() ||
        `Rayon personnalisé créé pour vos articles "${trimmedName}".`,
      subcategories:
        newCatSubcategories.length > 0
          ? newCatSubcategories
          : ['Articles & Produits divers'],
      popularTags: [`#${trimmedName.replace(/[^a-zA-Z0-9\u00C0-\u017F]/g, '')}`, '#BoutiqueAdjamé'],
      stats: 'Rayon personnalisé boutique',
      isCustom: true,
    };

    const updated = [createdCat, ...customCategories];
    saveCustomCategories(updated);
    setSelectedCategoryName(createdCat.name);
    setSelectedSubcategory(createdCat.subcategories[0] || null);

    // Reset form
    setNewCatName('');
    setNewCatIcon('🏷️');
    setNewCatDescription('');
    setNewCatSubcategories([]);
    setTempSubcatInput('');
    setIsCreatingCategory(false);
  };

  const handleDeleteCustomCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const toDelete = customCategories.find((c) => c.id === id);
    const updated = customCategories.filter((c) => c.id !== id);
    saveCustomCategories(updated);
    if (toDelete && selectedCategoryName === toDelete.name) {
      setSelectedCategoryName('Mode & Vêtements');
      setSelectedSubcategory(null);
    }
  };

  const handleAddInlineSubcategory = (catId: string) => {
    const trimmed = inlineSubcatInput.trim();
    if (!trimmed) return;

    const isCustom = customCategories.some((c) => c.id === catId);
    if (isCustom) {
      const updated = customCategories.map((c) => {
        if (c.id === catId && !c.subcategories.includes(trimmed)) {
          return { ...c, subcategories: [...c.subcategories, trimmed] };
        }
        return c;
      });
      saveCustomCategories(updated);
    } else {
      const targetDefault = CATEGORIES_CATALOG.find((c) => c.id === catId);
      if (targetDefault) {
        const customClone: CategoryData = {
          ...targetDefault,
          id: `custom_${targetDefault.id}_${Date.now()}`,
          subcategories: [...targetDefault.subcategories, trimmed],
          isCustom: true,
          badge: '✨ Modifié',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        };
        const updated = [customClone, ...customCategories.filter((c) => c.name !== targetDefault.name)];
        saveCustomCategories(updated);
      }
    }

    setSelectedSubcategory(trimmed);
    setInlineSubcatInput('');
    setInlineSubcatCatId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-[#121212] border border-white/10 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="sticky top-0 z-20 px-5 py-4 bg-[#141414]/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6321]/15 border border-[#FF6321]/30 flex items-center justify-center text-[#FF6321]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                Catégorie du produit
              </h3>
              <p className="text-[11px] text-white/50">
                Classez votre article pour maximiser sa visibilité auprès des acheteurs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SEARCH BAR & QUICK CREATE ACTION */}
        <div className="px-5 py-3 bg-[#121212] border-b border-white/5 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une catégorie, sous-catégorie (ex: baskets, pagne, mèches, iPhone...)"
                className="w-full p-2.5 pl-10 pr-9 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsCreatingCategory((prev) => !prev);
                if (!isCreatingCategory && searchQuery.trim()) {
                  setNewCatName(searchQuery.trim());
                }
              }}
              className={`px-3 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95 ${
                isCreatingCategory
                  ? 'bg-white/20 text-white'
                  : 'bg-gradient-to-r from-[#FF6321] to-[#FF8243] hover:opacity-95 text-white shadow-md shadow-[#FF6321]/20'
              }`}
            >
              {isCreatingCategory ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Fermer</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Créer</span>
                </>
              )}
            </button>
          </div>

          {/* AI / Smart Suggestion Banner if applicable */}
          {!isCreatingCategory && suggestedCategory && suggestedCategory.name !== selectedCategoryName && (
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-[#FF6321]/20 via-[#FF6321]/10 to-transparent border border-[#FF6321]/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-[#FF6321] shrink-0" />
                <span className="text-[11px] text-white/90 truncate">
                  Suggestion auto pour <span className="font-bold text-[#FF6321]">"{productName}"</span> :{' '}
                  <span className="font-bold">{suggestedCategory.name}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryName(suggestedCategory.name);
                  setSelectedSubcategory(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#FF6321] text-[10px] font-black text-white shrink-0 hover:bg-[#FF6321]/90 transition"
              >
                Appliquer
              </button>
            </div>
          )}

          {/* FORMULAIRE DE CRÉATION D'UNE NOUVELLE CATÉGORIE */}
          {isCreatingCategory && (
            <form
              onSubmit={handleCreateCategorySubmit}
              className="p-4 rounded-2xl bg-gradient-to-b from-[#1c1c1e] to-[#161617] border border-[#FF6321]/40 space-y-3.5 shadow-xl animate-in fade-in slide-in-from-top-3 duration-200"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#FF6321]/20 text-[#FF6321] flex items-center justify-center">
                    <FolderPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">
                      Créer une nouvelle catégorie
                    </h4>
                    <p className="text-[10px] text-white/50">
                      Personnalisez votre propre rayon de vente pour vos articles
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingCategory(false)}
                  className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Nom de la catégorie */}
              <div>
                <label className="text-[10px] font-bold text-white/80 block mb-1">
                  Nom de la catégorie *
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Ex: Artisanat & Perles, Coiffure & Tresses, Matériel Pro..."
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                  autoFocus
                />
              </div>

              {/* Emoji / Icône */}
              <div>
                <label className="text-[10px] font-bold text-white/80 block mb-1">
                  Icône / Emoji représentatif :
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#FF6321]/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
                    {newCatIcon}
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto py-1 no-scrollbar flex-1">
                    {PRESET_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewCatIcon(emoji)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 transition ${
                          newCatIcon === emoji
                            ? 'bg-[#FF6321] scale-110 shadow-sm'
                            : 'bg-white/5 hover:bg-white/15'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sous-catégories (Rayons de la catégorie) */}
              <div>
                <label className="text-[10px] font-bold text-white/80 block mb-1">
                  Sous-catégories / Rayons (Optionnel) :
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tempSubcatInput}
                    onChange={(e) => setTempSubcatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTempSubcategory();
                      }
                    }}
                    placeholder="Ex: Sacs en perles, Colliers, Bracelets..."
                    className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                  />
                  <button
                    type="button"
                    onClick={handleAddTempSubcategory}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>

                {/* Badges des sous-catégories ajoutées */}
                {newCatSubcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {newCatSubcategories.map((sub, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-xl bg-[#FF6321]/20 border border-[#FF6321]/30 text-white text-[11px] font-medium flex items-center gap-1.5"
                      >
                        <span>{sub}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTempSubcategory(idx)}
                          className="text-white/60 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Description rapide */}
              <div>
                <label className="text-[10px] font-bold text-white/80 block mb-1">
                  Description courte (Optionnel) :
                </label>
                <input
                  type="text"
                  value={newCatDescription}
                  onChange={(e) => setNewCatDescription(e.target.value)}
                  placeholder="Ex: Objets d'artisanat local fabriqués sur mesure à Abidjan."
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              {/* Actions de validation du formulaire */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreatingCategory(false)}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/70 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#FF6321]/90 disabled:opacity-40 disabled:pointer-events-none text-xs font-black text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-[#FF6321]/30 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Créer et sélectionner cette catégorie</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* BODY SCROLLABLE LIST */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 no-scrollbar">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/80">
              {filteredCategories.length} catégories disponibles à Adjamé :
            </span>
            <span className="text-[10px] text-white/40">Touchez pour sélectionner</span>
          </div>

          {/* QUICK PROMPT TO CREATE IF NOT ALREADY IN CREATION MODE */}
          {!isCreatingCategory && (
            <button
              type="button"
              onClick={() => {
                setIsCreatingCategory(true);
                if (searchQuery.trim()) {
                  setNewCatName(searchQuery.trim());
                }
              }}
              className="w-full p-3 rounded-2xl bg-gradient-to-r from-white/[0.04] to-[#FF6321]/10 border border-dashed border-white/20 hover:border-[#FF6321]/50 text-left transition flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FF6321]/20 text-[#FF6321] flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-[#FF6321] transition">
                    Votre rayon n'est pas dans la liste ?
                  </p>
                  <p className="text-[10px] text-white/50">
                    Créez votre propre catégorie personnalisée en 30 secondes
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#FF6321] px-2.5 py-1 rounded-lg bg-[#FF6321]/10 border border-[#FF6321]/20 shrink-0">
                + Créer
              </span>
            </button>
          )}

          {filteredCategories.length === 0 ? (
            <div className="py-10 text-center text-white/50 space-y-3 bg-white/[0.02] rounded-3xl border border-white/5 p-6">
              <Search className="w-8 h-8 mx-auto text-white/20" />
              <div>
                <p className="text-xs font-bold text-white">
                  Aucune catégorie trouvée pour "{searchQuery}"
                </p>
                <p className="text-[11px] text-white/40 max-w-sm mx-auto mt-1">
                  Vous pouvez créer instantanément ce rayon personnalisé pour votre boutique !
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewCatName(searchQuery.trim());
                  setIsCreatingCategory(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FF6321] hover:bg-[#FF6321]/90 text-xs font-black text-white transition shadow-lg shadow-orange-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Créer la catégorie "{searchQuery}"</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCategories.map((cat) => {
                const isSelected = selectedCategoryName === cat.name;

                return (
                  <div
                    key={cat.id}
                    className={`rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-[#FF6321]/10 border-[#FF6321] shadow-lg shadow-[#FF6321]/10'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Category Header Row */}
                    <div
                      onClick={() => {
                        setSelectedCategoryName(cat.name);
                        if (!isSelected) {
                          setSelectedSubcategory(null);
                        }
                      }}
                      className="p-3.5 flex items-start justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                            isSelected
                              ? 'bg-[#FF6321] text-white shadow-md shadow-[#FF6321]/30'
                              : 'bg-white/10 text-white'
                          }`}
                        >
                          {cat.icon}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-white">
                              {cat.name}
                            </h4>
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${cat.badgeColor}`}
                            >
                              {cat.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/60 leading-relaxed">
                            {cat.description}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium pt-0.5">
                            <TrendingUp className="w-3 h-3" />
                            <span>{cat.stats}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1 shrink-0">
                        {cat.isCustom && (
                          <button
                            type="button"
                            title="Supprimer cette catégorie personnalisée"
                            onClick={(e) => handleDeleteCustomCategory(cat.id, e)}
                            className="w-7 h-7 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                            isSelected
                              ? 'bg-[#FF6321] border-[#FF6321] text-white'
                              : 'border-white/30 text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      </div>
                    </div>

                    {/* Subcategories (Visible when selected) */}
                    {isSelected && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-white/10 mt-1 space-y-2.5">
                        <div className="flex items-center justify-between text-[10px] text-white/70">
                          <span className="font-bold">
                            Préciser la sous-catégorie (Optionnel) :
                          </span>
                          {selectedSubcategory && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSubcategory(null);
                              }}
                              className="text-[#FF6321] hover:underline font-bold"
                            >
                              Effacer
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 items-center">
                          {cat.subcategories.map((sub) => {
                            const isSubSelected = selectedSubcategory === sub;
                            return (
                              <button
                                key={sub}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectSub(sub);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-medium border transition ${
                                  isSubSelected
                                    ? 'bg-[#FF6321] text-white border-[#FF6321] shadow-sm'
                                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                {sub}
                              </button>
                            );
                          })}

                          {/* INLINE ADD SUBCATEGORY BUTTON */}
                          {inlineSubcatCatId !== cat.id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInlineSubcatCatId(cat.id);
                                setInlineSubcatInput('');
                              }}
                              className="px-2 py-1 rounded-xl text-[10px] font-bold border border-dashed border-[#FF6321]/40 text-[#FF6321] hover:bg-[#FF6321]/10 transition flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3 stroke-[3]" />
                              <span>Ajouter un rayon</span>
                            </button>
                          )}
                        </div>

                        {/* INLINE SUBCATEGORY INPUT FORM */}
                        {inlineSubcatCatId === cat.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-xl bg-black/40 border border-[#FF6321]/40 flex items-center gap-2 mt-1 animate-in fade-in duration-150"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={inlineSubcatInput}
                              onChange={(e) => setInlineSubcatInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddInlineSubcategory(cat.id);
                                }
                              }}
                              placeholder="Nom du nouveau sous-rayon..."
                              className="flex-1 p-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddInlineSubcategory(cat.id)}
                              disabled={!inlineSubcatInput.trim()}
                              className="px-2.5 py-1.5 rounded-lg bg-[#FF6321] hover:bg-[#FF6321]/90 disabled:opacity-40 text-[10px] font-bold text-white transition shrink-0"
                            >
                              Ajouter
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineSubcatCatId(null)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* APERÇU SÉLECTION ACTUELLE */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#FF6321]/10 via-white/5 to-transparent border border-[#FF6321]/20 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#FF6321] text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Catégorie sélectionnée pour l'article :</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg">{currentCategoryData.icon}</span>
              <span className="text-xs font-black text-white">
                {currentCategoryData.name}
              </span>
              {selectedSubcategory && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6321]/20 text-[#FF6321] border border-[#FF6321]/30">
                  › {selectedSubcategory}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Votre produit sera mis en avant dans la section "{currentCategoryData.name}" et bénéficiera des recommandations d'achat ciblées à Abidjan.
            </p>
          </div>
        </div>

        {/* BOTTOM STICKY ACTION */}
        <div className="p-4 bg-[#141414] border-t border-white/10 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-3.5 rounded-2xl bg-[#FF6321] hover:bg-[#FF6321]/90 text-xs sm:text-sm font-black text-white transition shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Valider cette catégorie</span>
          </button>
        </div>
      </div>
    </div>
  );
};
