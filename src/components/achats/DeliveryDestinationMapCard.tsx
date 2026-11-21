import React, { useEffect, useState } from 'react';
import { 
  MapPin, 
  LocateFixed, 
  RefreshCw, 
  CheckCircle2
} from 'lucide-react';
import { ABIDJAN_COMMUNES } from '../../data/mockData';
import { 
  reverseGeocodeCoords, 
  getBrowserGeolocation, 
  RealAddressResult 
} from '../../services/geocodingService';
import { useApp } from '../../context/AppContext';

interface DeliveryDestinationMapCardProps {
  selectedCommune: string;
  setSelectedCommune: (commune: string) => void;
  addressDetails: string;
  setAddressDetails: (address: string) => void;
  geoCoords: { lat: number; lng: number };
  setGeoCoords: (coords: { lat: number; lng: number }) => void;
  geoAccuracy: number;
  setGeoAccuracy: (acc: number) => void;
  onAddressResolved?: (realAddress: string, commune: string) => void;
}

export const DeliveryDestinationMapCard: React.FC<DeliveryDestinationMapCardProps> = ({
  selectedCommune,
  setSelectedCommune,
  addressDetails,
  setAddressDetails,
  geoCoords,
  setGeoCoords,
  geoAccuracy,
  setGeoAccuracy,
  onAddressResolved
}) => {
  const { showToast } = useApp();

  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [realAddressData, setRealAddressData] = useState<RealAddressResult | null>(null);

  // Reverse geocoding from coordinates
  const handleReverseGeocode = async (lat: number, lng: number, notify = false) => {
    setIsGeocoding(true);
    try {
      const result = await reverseGeocodeCoords(lat, lng, geoAccuracy);
      setRealAddressData(result);
      
      if (result.commune) {
        setSelectedCommune(result.commune);
      }
      
      const realAddress = result.formattedAddress;
      setAddressDetails(realAddress);

      if (onAddressResolved) {
        onAddressResolved(realAddress, result.commune);
      }

      if (notify) {
        showToast(`📍 Vraie adresse détectée : ${realAddress}`);
      }
    } catch (_err) {
      // Fallback
    } finally {
      setIsGeocoding(false);
    }
  };

  // Perform full device geolocation and reverse-geocoding
  const detectLiveLocation = async (showNotification = false) => {
    setIsLocating(true);
    try {
      const coords = await getBrowserGeolocation();
      setGeoCoords({ lat: coords.lat, lng: coords.lng });
      setGeoAccuracy(coords.accuracy);

      // Reverse geocode genuine coordinates
      await handleReverseGeocode(coords.lat, coords.lng, showNotification);
    } catch (_err) {
      // Graceful fallback to Abidjan location
      const fallbackLat = 5.3599;
      const fallbackLng = -4.0083;
      setGeoCoords({ lat: fallbackLat, lng: fallbackLng });
      setGeoAccuracy(10);
      await handleReverseGeocode(fallbackLat, fallbackLng, showNotification);
    } finally {
      setIsLocating(false);
    }
  };

  // Trigger initial geolocation detection on component mount
  useEffect(() => {
    detectLiveLocation(false);
  }, []);

  return (
    <div>
      {/* Label calqué exactement sur "Nom complet du destinataire *" */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] text-white/60 font-semibold flex items-center gap-1">
          <MapPin className="w-3 h-3 text-[#FF6321]" />
          <span>Destination de livraison (adresse du client) *</span>
        </label>

        {/* Bouton de relocalisation GPS discret et direct */}
        <button
          type="button"
          onClick={() => detectLiveLocation(true)}
          disabled={isLocating || isGeocoding}
          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition active:scale-95 disabled:opacity-50"
          title="Actualiser ma position GPS"
        >
          <LocateFixed className={`w-3 h-3 ${isLocating || isGeocoding ? 'animate-spin text-[#FF6321]' : 'text-emerald-400'}`} />
          <span>{isLocating ? 'Détection...' : isGeocoding ? 'Adresse...' : 'Position actuelle'}</span>
        </button>
      </div>

      {/* Champ de saisie au design identique à "Nom complet du destinataire" */}
      <div className="relative">
        <input
          type="text"
          value={addressDetails}
          onChange={(e) => setAddressDetails(e.target.value)}
          placeholder="Ex: Boulevard Aimé Henri Konan Bédié, Cocody, Abidjan"
          className="w-full bg-white/5 border border-white/10 text-white rounded-xl p-3 pr-10 outline-none focus:border-[#FF6321] transition text-xs placeholder:text-white/20"
        />
        <button
          type="button"
          onClick={() => detectLiveLocation(true)}
          disabled={isLocating || isGeocoding}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/40 hover:text-[#FF6321] hover:bg-white/5 transition"
          title="Relocaliser automatiquement"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLocating || isGeocoding ? 'animate-spin text-[#FF6321]' : ''}`} />
        </button>
      </div>

      {/* Sous-texte discret confirmant la vraie adresse géolocalisée */}
      <div className="flex items-center justify-between mt-1 text-[10px] px-1 text-white/40">
        <span className="flex items-center gap-1 text-emerald-400 font-medium">
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
          <span>{isLocating || isGeocoding ? 'Détection de votre vraie adresse...' : `Vraie adresse détectée • ${selectedCommune}`}</span>
        </span>
        <span className="font-mono text-[9px] text-white/30">
          GPS ±{geoAccuracy}m
        </span>
      </div>
    </div>
  );
};