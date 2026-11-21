// Coordinates for Abidjan Communes, Markets and Key Hubs
export interface GeoPoint {
  lat: number;
  lng: number;
  name: string;
}

export const ABIDJAN_CENTROID = { lat: 5.3599, lng: -4.0083 };

export const ABIDJAN_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  // Adjamé (Commerce & Marchés)
  'adjamé': { lat: 5.3621, lng: -4.0255 },
  'adjamé forum des marchés': { lat: 5.3645, lng: -4.0238 },
  'forum des marchés': { lat: 5.3645, lng: -4.0238 },
  'adjamé roxy': { lat: 5.3582, lng: -4.0298 },
  'roxy': { lat: 5.3582, lng: -4.0298 },
  'adjamé 220 logements': { lat: 5.3512, lng: -4.0195 },
  '220 logements': { lat: 5.3512, lng: -4.0195 },
  'adjamé liberté': { lat: 5.3598, lng: -4.0281 },
  'mirador': { lat: 5.3610, lng: -4.0310 },

  // Cocody
  'cocody': { lat: 5.3448, lng: -3.9984 },
  'cocody st jean': { lat: 5.3448, lng: -3.9984 },
  'st jean': { lat: 5.3448, lng: -3.9984 },
  'saint-jean': { lat: 5.3448, lng: -3.9984 },
  'angré': { lat: 5.3852, lng: -3.9781 },
  'angré 8ème tranche': { lat: 5.3852, lng: -3.9781 },
  '8ème tranche': { lat: 5.3852, lng: -3.9781 },
  'deux-plateaux': { lat: 5.3619, lng: -3.9875 },
  'vallons': { lat: 5.3580, lng: -3.9940 },
  'riviera': { lat: 5.3520, lng: -3.9620 },
  'riviera 2': { lat: 5.3520, lng: -3.9620 },
  'palmeraie': { lat: 5.3720, lng: -3.9510 },

  // Plateau
  'plateau': { lat: 5.3261, lng: -4.0197 },
  'cité administrative': { lat: 5.3280, lng: -4.0180 },
  'rue du commerce': { lat: 5.3220, lng: -4.0190 },

  // Yopougon
  'yopougon': { lat: 5.3397, lng: -4.0721 },
  'maroc': { lat: 5.3450, lng: -4.0850 },
  'siporex': { lat: 5.3350, lng: -4.0550 },
  'sideci': { lat: 5.3420, lng: -4.0780 },
  'bel air': { lat: 5.3510, lng: -4.0620 },

  // Marcory
  'marcory': { lat: 5.2915, lng: -3.9876 },
  'zone 4': { lat: 5.2850, lng: -3.9780 },
  'biétry': { lat: 5.2790, lng: -3.9920 },
  'anoumabo': { lat: 5.3020, lng: -3.9910 },

  // Treichville
  'treichville': { lat: 5.3082, lng: -4.0112 },
  'vge': { lat: 5.3010, lng: -4.0050 },
  'gare bassam': { lat: 5.3090, lng: -4.0150 },

  // Koumassi
  'koumassi': { lat: 5.3021, lng: -3.9512 },
  'remblais': { lat: 5.3010, lng: -3.9480 },

  // Abobo
  'abobo': { lat: 5.4182, lng: -4.0152 },
  'abobo baoulé': { lat: 5.4220, lng: -4.0110 },
  'samaké': { lat: 5.4110, lng: -4.0190 },

  // Attécoubé
  'attécoubé': { lat: 5.3380, lng: -4.0320 },
  'boribana': { lat: 5.3310, lng: -4.0290 },

  // Port-Bouët
  'port-bouët': { lat: 5.2580, lng: -3.9450 },
  'aéroport': { lat: 5.2610, lng: -3.9310 },
  'bingerville': { lat: 5.3580, lng: -3.8890 },
};

/**
 * Resolves latitude and longitude for a given location and commune string in Abidjan
 */
export function resolveCoordinates(locationStr: string, communeStr?: string): { lat: number; lng: number } {
  const cleanLoc = (locationStr || '').toLowerCase().trim();
  const cleanCommune = (communeStr || '').toLowerCase().trim();

  if (cleanLoc) {
    for (const [key, coords] of Object.entries(ABIDJAN_LOCATIONS)) {
      if (cleanLoc.includes(key)) {
        return coords;
      }
    }
  }

  if (cleanCommune) {
    for (const [key, coords] of Object.entries(ABIDJAN_LOCATIONS)) {
      if (cleanCommune.includes(key)) {
        return coords;
      }
    }
  }

  return { lat: 5.3621, lng: -4.0255 };
}

/**
 * Calculates straight line distance in km between two GPS coordinates (Haversine formula)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
