// Photographies studio plein pied (tête aux pieds) de mannequins réels avec morphologies distinctes Homme & Femme
import mannequinFemmeFine from '../../assets/images/mannequin_femme_fine_1795126010397.jpg';
import mannequinFemmeMoyenne from '../../assets/images/mannequin_femme_moyenne_1795126009213.jpg';
import mannequinFemmeRonde from '../../assets/images/mannequin_femme_ronde_1795126009968.jpg';
import mannequinFemmeGrande from '../../assets/images/mannequin_femme_grande_1795126009537.jpg';

import mannequinHommeMince from '../../assets/images/mannequin_homme_mince_1795126009625.jpg';
import mannequinHommeMoyenne from '../../assets/images/mannequin_homme_moyenne_1795126010698.jpg';
import mannequinHommeAthletique from '../../assets/images/mannequin_homme_athletique_1795126010496.jpg';
import mannequinHommeCorpulent from '../../assets/images/mannequin_homme_corpulent_1795126009686.jpg';

export interface TryOnModel {
  id: string;
  name: string;
  gender: 'female' | 'male';
  size: string;
  height: string;
  morphologyLabel: string;
  morphology: string;
  skinTone: string;
  badge?: string;
  avatar: string;
  frontImage: string;
  sideImage: string;
  backImage: string;
  closeUpImage: string;
  drapeFitNotes: string;
}

// ==========================================
// 4 MORPHOLOGIES FEMME (Plein pied studio)
// ==========================================
export const FEMALE_TRY_ON_MODELS: TryOnModel[] = [
  {
    id: 'mannequin-femme-fine',
    name: 'Awa',
    gender: 'female',
    size: 'S',
    height: '1m74',
    morphologyLabel: 'Fine',
    morphology: 'Silhouette fine et élancée (épaules menues, taille marquée)',
    skinTone: 'Ébène satiné',
    badge: 'Plein pied',
    avatar: mannequinFemmeFine,
    frontImage: mannequinFemmeFine,
    sideImage: mannequinFemmeFine,
    backImage: mannequinFemmeFine,
    closeUpImage: mannequinFemmeFine,
    drapeFitNotes: 'Coupe cintrée près du corps, tombé droit fluide sur silhouette fine (taille S)'
  },
  {
    id: 'mannequin-femme-moyenne',
    name: 'Kadiatou',
    gender: 'female',
    size: 'M',
    height: '1m71',
    morphologyLabel: 'Moyenne',
    morphology: 'Morphologie équilibrée et proportionnée (taille standard M)',
    skinTone: 'Caramel naturel',
    badge: 'Standard',
    avatar: mannequinFemmeMoyenne,
    frontImage: mannequinFemmeMoyenne,
    sideImage: mannequinFemmeMoyenne,
    backImage: mannequinFemmeMoyenne,
    closeUpImage: mannequinFemmeMoyenne,
    drapeFitNotes: 'Aisance standard et tombé équilibré au buste et aux hanches (taille M)'
  },
  {
    id: 'mannequin-femme-ronde',
    name: 'Fatou',
    gender: 'female',
    size: 'L/XL',
    height: '1m69',
    morphologyLabel: 'Ronde',
    morphology: 'Courbes marquées, hanches généreuses et poitrine féminine',
    skinTone: 'Ébène chaud',
    badge: 'Courbes',
    avatar: mannequinFemmeRonde,
    frontImage: mannequinFemmeRonde,
    sideImage: mannequinFemmeRonde,
    backImage: mannequinFemmeRonde,
    closeUpImage: mannequinFemmeRonde,
    drapeFitNotes: 'Tombé naturel respectant les courbes au niveau de la taille et des hanches (taille L/XL)'
  },
  {
    id: 'mannequin-femme-grande',
    name: 'Aminata',
    gender: 'female',
    size: 'XXL',
    height: '1m70',
    morphologyLabel: 'Grande taille',
    morphology: 'Corpulence généreuse grande taille avec carrure et hanches amples',
    skinTone: 'Miel doré',
    badge: 'Plus Size',
    avatar: mannequinFemmeGrande,
    frontImage: mannequinFemmeGrande,
    sideImage: mannequinFemmeGrande,
    backImage: mannequinFemmeGrande,
    closeUpImage: mannequinFemmeGrande,
    drapeFitNotes: 'Coupe confortable grande taille sans tiraillement aux épaules ni aux hanches (taille XXL)'
  }
];

// ==========================================
// 4 MORPHOLOGIES HOMME (Plein pied studio)
// ==========================================
export const MALE_TRY_ON_MODELS: TryOnModel[] = [
  {
    id: 'mannequin-homme-mince',
    name: 'Yao',
    gender: 'male',
    size: 'S',
    height: '1m80',
    morphologyLabel: 'Mince',
    morphology: 'Silhouette mince et longiligne, buste fin et taille ajustée',
    skinTone: 'Ébène mat',
    badge: 'Plein pied',
    avatar: mannequinHommeMince,
    frontImage: mannequinHommeMince,
    sideImage: mannequinHommeMince,
    backImage: mannequinHommeMince,
    closeUpImage: mannequinHommeMince,
    drapeFitNotes: 'Coupe ajustée nette sans surplus de tissu sur buste mince (taille S)'
  },
  {
    id: 'mannequin-homme-moyenne',
    name: 'Koffi',
    gender: 'male',
    size: 'M',
    height: '1m79',
    morphologyLabel: 'Moyenne',
    morphology: 'Carrure moyenne proportionnée, buste droit standard',
    skinTone: 'Caramel profond',
    badge: 'Standard',
    avatar: mannequinHommeMoyenne,
    frontImage: mannequinHommeMoyenne,
    sideImage: mannequinHommeMoyenne,
    backImage: mannequinHommeMoyenne,
    closeUpImage: mannequinHommeMoyenne,
    drapeFitNotes: 'Tombé droit classique au niveau des épaules et de la taille (taille M)'
  },
  {
    id: 'mannequin-homme-athletique',
    name: 'Malik',
    gender: 'male',
    size: 'L',
    height: '1m84',
    morphologyLabel: 'Athlétique',
    morphology: 'Épaules larges, torse développé et taille dessinée en V',
    skinTone: 'Ébène noble',
    badge: 'Athlétique',
    avatar: mannequinHommeAthletique,
    frontImage: mannequinHommeAthletique,
    sideImage: mannequinHommeAthletique,
    backImage: mannequinHommeAthletique,
    closeUpImage: mannequinHommeAthletique,
    drapeFitNotes: 'Aisance structurée aux épaules et aux bras avec cintrage naturel au torse (taille L)'
  },
  {
    id: 'mannequin-homme-corpulent',
    name: 'Ibrahim',
    gender: 'male',
    size: 'XL/XXL',
    height: '1m82',
    morphologyLabel: 'Corpulente',
    morphology: 'Carrure large et torse plein, gabarit ample XL/XXL',
    skinTone: 'Ébène profond',
    badge: 'Grand gabarit',
    avatar: mannequinHommeCorpulent,
    frontImage: mannequinHommeCorpulent,
    sideImage: mannequinHommeCorpulent,
    backImage: mannequinHommeCorpulent,
    closeUpImage: mannequinHommeCorpulent,
    drapeFitNotes: 'Coupe ample et aérée garantissant le tombé fluide sur gabarit corpulent (taille XL/XXL)'
  }
];

export const TRY_ON_MODELS: TryOnModel[] = [
  ...MALE_TRY_ON_MODELS,
  ...FEMALE_TRY_ON_MODELS
];
