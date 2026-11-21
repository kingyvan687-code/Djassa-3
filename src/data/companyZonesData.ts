export const ALL_ABIDJAN_COMMUNES: string[] = [
  'Cocody',
  'Plateau',
  'Adjamé',
  'Marcory',
  'Treichville',
  'Yopougon',
  'Koumassi',
  'Abobo',
  'Port-Bouët',
  'Attécoubé',
  'Bingerville',
  'Anyama',
  'Songon',
  'Grand-Bassam'
];

export interface ZoneDeliveryTimes {
  operatingHours?: string;
  operatingDays?: string;
  standardCutoffHour?: string;
  standardDelay: string;
  standardMinMinutes?: number;
  standardMaxMinutes?: number;
  expressDelay: string;
  expressMinutes?: number;
  expressEnabled: boolean;
  interZoneDelay: string;
  heavyPackageDelay?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  code: string;
  badgeColor: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue';
  active: boolean;
  communes: string[];
  neighborhoods?: string[];
  tariffs: {
    standard: number;
    express45m: number;
    interZone: number;
    heavyPackage?: number;
  };
  marginPercent: number;
  averageDelayMin: number;
  assignedDriverIds: string[];
  description?: string;
  deliveryTimes?: ZoneDeliveryTimes;
}

export const INITIAL_DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: 'zone-centre-nord',
    name: 'Zone Centre & Marchés (Adjamé • Plateau • Attécoubé)',
    code: 'ABJ-NORD',
    badgeColor: 'cyan',
    active: true,
    communes: ['Adjamé', 'Plateau', 'Attécoubé'],
    neighborhoods: ['Forum des Marchés', 'Roxy', '220 Logements', 'Cité Administrative', 'Commerce'],
    tariffs: {
      standard: 1200,
      express45m: 2000,
      interZone: 1800,
      heavyPackage: 2500
    },
    marginPercent: 35,
    averageDelayMin: 30,
    assignedDriverIds: ['cd-1', 'driver-1', 'cd-3'],
    description: 'Cœur commercial d’Adjamé et quartier d’affaires du Plateau avec rotations toutes les 15 min.',
    deliveryTimes: {
      operatingHours: '07:30 - 20:30',
      operatingDays: '7j / 7 (Lun - Dim)',
      standardCutoffHour: '18h00',
      standardDelay: '1h - 2h',
      expressDelay: '35 min chrono',
      expressEnabled: true,
      interZoneDelay: '1h30 - 2h30',
      heavyPackageDelay: '2h - 3h'
    }
  },
  {
    id: 'zone-est-cocody',
    name: 'Zone Est Résidentielle (Cocody • Riviera • Bingerville)',
    code: 'ABJ-EST',
    badgeColor: 'emerald',
    active: true,
    communes: ['Cocody', 'Bingerville'],
    neighborhoods: ['Angré 8e Tranche', 'Deux-Plateaux', 'Riviera Palmeraie', 'Riviera Golf', 'Saint-Jean'],
    tariffs: {
      standard: 1500,
      express45m: 2500,
      interZone: 2000,
      heavyPackage: 3000
    },
    marginPercent: 35,
    averageDelayMin: 38,
    assignedDriverIds: ['cd-2', 'driver-2'],
    description: 'Couverture haute fréquence sur Angré, Deux-Plateaux, Riviera et Bingerville.',
    deliveryTimes: {
      operatingHours: '08:00 - 21:00',
      operatingDays: '7j / 7 (Lun - Dim)',
      standardCutoffHour: '18h30',
      standardDelay: '1h30 - 2h30',
      expressDelay: '45 min chrono',
      expressEnabled: true,
      interZoneDelay: '2h - 3h',
      heavyPackageDelay: '2h - 4h'
    }
  },
  {
    id: 'zone-sud-lagune',
    name: 'Zone Sud & Zone 4 (Marcory • Treichville • Koumassi • Port-Bouët)',
    code: 'ABJ-SUD',
    badgeColor: 'amber',
    active: true,
    communes: ['Marcory', 'Treichville', 'Koumassi', 'Port-Bouët'],
    neighborhoods: ['Zone 4C', 'Biétry', 'Gare de Bassam', 'Remblais', 'Vridi'],
    tariffs: {
      standard: 1500,
      express45m: 2500,
      interZone: 2200,
      heavyPackage: 2800
    },
    marginPercent: 35,
    averageDelayMin: 40,
    assignedDriverIds: ['cd-2', 'cd-4', 'driver-2'],
    description: 'Desserte rapide via les ponts HKB, De Gaulle et Houphouët-Boigny.',
    deliveryTimes: {
      operatingHours: '07:30 - 20:30',
      operatingDays: '7j / 7 (Lun - Dim)',
      standardCutoffHour: '18h00',
      standardDelay: '1h30 - 2h30',
      expressDelay: '45 min chrono',
      expressEnabled: true,
      interZoneDelay: '2h - 3h',
      heavyPackageDelay: '2h - 4h'
    }
  },
  {
    id: 'zone-ouest-yopougon',
    name: 'Zone Ouest (Yopougon • Abobo • Songon)',
    code: 'ABJ-OUEST',
    badgeColor: 'purple',
    active: true,
    communes: ['Yopougon', 'Abobo', 'Songon'],
    neighborhoods: ['Siporex', 'Maroc', 'Niangon', 'Selmer', 'Dokui', 'Samaké'],
    tariffs: {
      standard: 1500,
      express45m: 2400,
      interZone: 2200,
      heavyPackage: 3000
    },
    marginPercent: 35,
    averageDelayMin: 45,
    assignedDriverIds: ['cd-4', 'driver-1'],
    description: 'Axe Yopougon Siporex / Niangon / Maroc et Abobo Grand Carrefour.',
    deliveryTimes: {
      operatingHours: '07:30 - 20:00',
      operatingDays: '6j / 7 (Lun - Sam)',
      standardCutoffHour: '17h30',
      standardDelay: '2h - 3h',
      expressDelay: '55 min',
      expressEnabled: true,
      interZoneDelay: '2h30 - 4h',
      heavyPackageDelay: '3h - 5h'
    }
  }
];
