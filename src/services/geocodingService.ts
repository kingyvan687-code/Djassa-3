import { ABIDJAN_COMMUNES } from '../data/mockData';
import { calculateDistanceKm } from '../utils/abidjanGeo';

export interface RealAddressResult {
  formattedAddress: string;
  street: string;
  quartier: string;
  commune: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  accuracy: number;
  source: 'google_maps' | 'gps_abidjan_grid';
}

// Local authentic Abidjan street-level database for accurate offline or network-resilient resolution
const REAL_ABIDJAN_STREET_DATABASE: Array<{
  commune: string;
  quartier: string;
  street: string;
  lat: number;
  lng: number;
}> = [
  { commune: 'Cocody', quartier: 'Angré 8ème Tranche', street: 'Boulevard Latrille', lat: 5.3852, lng: -3.9781 },
  { commune: 'Cocody', quartier: 'Angré 7ème Tranche', street: 'Rue L12', lat: 5.3890, lng: -3.9810 },
  { commune: 'Cocody', quartier: 'Deux-Plateaux Vallons', street: 'Rue des Jardins', lat: 5.3580, lng: -3.9940 },
  { commune: 'Cocody', quartier: 'Deux-Plateaux Aghien', street: 'Boulevard des Martyrs', lat: 5.3680, lng: -3.9910 },
  { commune: 'Cocody', quartier: 'Riviera Palmeraie', street: 'Boulevard François Mitterrand', lat: 5.3720, lng: -3.9510 },
  { commune: 'Cocody', quartier: 'Riviera Golf', street: 'Boulevard de France', lat: 5.3390, lng: -3.9720 },
  { commune: 'Cocody', quartier: 'Saint-Jean / Danga', street: 'Avenue Jean Mermoz', lat: 5.3448, lng: -3.9984 },
  { commune: 'Plateau', quartier: 'Centre des Affaires', street: 'Boulevard de la République', lat: 5.3261, lng: -4.0197 },
  { commune: 'Plateau', quartier: 'Commerce', street: 'Avenue Chardy', lat: 5.3220, lng: -4.0190 },
  { commune: 'Plateau', quartier: 'Cité Administrative', street: 'Rue du Commerce', lat: 5.3280, lng: -4.0180 },
  { commune: 'Adjamé', quartier: 'Forum des Marchés', street: 'Boulevard Nangui Abrogoua', lat: 5.3645, lng: -4.0238 },
  { commune: 'Adjamé', quartier: '220 Logements', street: 'Avenue Reboul', lat: 5.3512, lng: -4.0195 },
  { commune: 'Adjamé', quartier: 'Roxy', street: 'Boulevard de la Paix', lat: 5.3582, lng: -4.0298 },
  { commune: 'Marcory', quartier: 'Zone 4C', street: 'Rue Paul Langevin / Rue du Canal', lat: 5.2850, lng: -3.9780 },
  { commune: 'Marcory', quartier: 'Biétry', street: 'Boulevard de Marseille', lat: 5.2790, lng: -3.9920 },
  { commune: 'Marcory', quartier: 'Résidentiel', street: 'Boulevard du Gabon', lat: 5.2915, lng: -3.9876 },
  { commune: 'Treichville', quartier: 'Avenue 16', street: 'Boulevard Valéry Giscard d’Estaing', lat: 5.3082, lng: -4.0112 },
  { commune: 'Treichville', quartier: 'Gare de Bassam', street: 'Rue des Brasseurs', lat: 5.3090, lng: -4.0150 },
  { commune: 'Koumassi', quartier: 'Remblais', street: 'Boulevard du 7 Décembre', lat: 5.3021, lng: -3.9512 },
  { commune: 'Koumassi', quartier: 'Grand Campement', street: 'Rue du Canal', lat: 5.2980, lng: -3.9450 },
  { commune: 'Yopougon', quartier: 'Siporex / Selmer', street: 'Boulevard Principal de Yopougon', lat: 5.3350, lng: -4.0550 },
  { commune: 'Yopougon', quartier: 'Maroc', street: 'Carrefour Oasis', lat: 5.3450, lng: -4.0850 },
  { commune: 'Yopougon', quartier: 'Sideci / Niangon', street: 'Rue Terminus 40', lat: 5.3420, lng: -4.0780 },
  { commune: 'Abobo', quartier: 'Samaké', street: 'Voie Express Abobo-Adjamé', lat: 5.4110, lng: -4.0190 },
  { commune: 'Abobo', quartier: 'Gare / Mairie', street: 'Avenue de la Mairie', lat: 5.4182, lng: -4.0152 },
  { commune: 'Port-Bouët', quartier: 'Vridi', street: 'Boulevard de Vridi', lat: 5.2580, lng: -3.9450 },
  { commune: 'Port-Bouët', quartier: 'Aéroport Félix Houphouët-Boigny', street: 'Boulevard de l’Aéroport', lat: 5.2610, lng: -3.9310 },
  { commune: 'Attécoubé', quartier: 'Boribana', street: 'Boulevard de la Paix', lat: 5.3380, lng: -4.0320 }
];

/**
 * Géocodage inversé sécurisé via le proxy backend Google Maps Platform (/api/maps/reverse-geocode),
 * avec repli sur le maillage géographique local d'Abidjan.
 */
export async function reverseGeocodeCoords(lat: number, lng: number, accuracy = 10): Promise<RealAddressResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch('/api/maps/reverse-geocode', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ lat, lng })
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.formattedAddress) {
        const rawText = `${data.formattedAddress} ${data.quartier || ''} ${data.commune || ''} ${data.city || ''}`.toLowerCase();
        let detectedCommune = data.commune || 'Cocody';
        for (const comm of ABIDJAN_COMMUNES) {
          if (rawText.includes(comm.toLowerCase())) {
            detectedCommune = comm;
            break;
          }
        }
        return {
          formattedAddress: String(data.formattedAddress),
          street: String(data.street || ''),
          quartier: String(data.quartier || detectedCommune),
          commune: detectedCommune,
          city: String(data.city || 'Abidjan'),
          country: String(data.country || 'Côte d’Ivoire'),
          lat,
          lng,
          accuracy,
          source: 'google_maps'
        };
      }
    }
  } catch {
    // Repli local sur la grille Abidjan
  }

  let bestDist = Infinity;
  let bestMatch = REAL_ABIDJAN_STREET_DATABASE[0];

  for (const item of REAL_ABIDJAN_STREET_DATABASE) {
    const dist = calculateDistanceKm(lat, lng, item.lat, item.lng);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = item;
    }
  }

  const realFormatted = `${bestMatch.street}, ${bestMatch.quartier}, ${bestMatch.commune}`;

  return {
    formattedAddress: realFormatted,
    street: bestMatch.street,
    quartier: bestMatch.quartier,
    commune: bestMatch.commune,
    city: 'Abidjan',
    country: 'Côte d’Ivoire',
    lat,
    lng,
    accuracy,
    source: 'gps_abidjan_grid'
  };
}

/**
 * Browser-native geolocation promise wrapper with high accuracy
 */
export function getBrowserGeolocation(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation non supportée'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 10)
        });
      },
      (err) => {
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 30000
      }
    );
  });
}
