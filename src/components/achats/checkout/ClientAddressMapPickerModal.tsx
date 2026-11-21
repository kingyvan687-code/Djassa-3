import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, LocateFixed, Check, MapPin, Loader2 } from 'lucide-react';
import { getBrowserGeolocation, reverseGeocodeCoords } from '../../../services/geocodingService';
import { CheckoutTheme, getCheckoutPalette } from './checkoutTypes';

interface ClientAddressMapPickerModalProps {
  theme?: CheckoutTheme;
  fullWidth?: boolean;
  initialCoords?: { lat: number; lng: number };
  onConfirmLocation: (result: {
    lat: number;
    lng: number;
    commune: string;
    quartier: string;
    details: string;
  }) => void;
  onClose: () => void;
}

const DEFAULT_ABIDJAN_CENTER = { lat: 5.3484, lng: -4.0197 };

export const ClientAddressMapPickerModal: React.FC<ClientAddressMapPickerModalProps> = ({
  theme = 'neon',
  fullWidth = false,
  initialCoords,
  onConfirmLocation,
  onClose
}) => {
  const pal = getCheckoutPalette(theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const startPos = initialCoords || DEFAULT_ABIDJAN_CENTER;
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(startPos);
  const [resolvedAddress, setResolvedAddress] = useState<{
    commune: string;
    quartier: string;
    details: string;
  }>({
    commune: 'Cocody',
    quartier: '',
    details: 'Déplacez le marqueur ou touchez la carte pour choisir votre point exact'
  });
  const [isResolving, setIsResolving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const resolveCoordsAddress = async (lat: number, lng: number, accuracy = 12) => {
    setIsResolving(true);
    try {
      const addr = await reverseGeocodeCoords(lat, lng, accuracy);
      setResolvedAddress({
        commune: addr.commune || 'Cocody',
        quartier: addr.quartier || addr.city || '',
        details: addr.formattedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      });
    } catch {
      setResolvedAddress((prev) => ({
        ...prev,
        details: `Position GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`
      }));
    } finally {
      setIsResolving(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [startPos.lat, startPos.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: 'abc',
      className: 'dark-map-tiles'
    }).addTo(map);

    const pinMain = pal.isClient ? '#FF6321' : '#16E575';
    const pinBorder = pal.isClient ? '#140A05' : '#05130B';
    const pinShadow = pal.isClient ? 'rgba(255,99,33,0.7)' : 'rgba(22,229,117,0.7)';

    const pinIcon = L.divIcon({
      className: 'custom-client-pin',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:34px;height:34px;border-radius:9999px;background:${pinMain};border:3px solid ${pinBorder};box-shadow:0 0 20px ${pinShadow};display:flex;align-items:center;justify-content:center;">
            <div style="width:10px;height:10px;border-radius:9999px;background:${pinBorder};"></div>
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${pinMain};margin-top:-1px;"></div>
        </div>
      `,
      iconSize: [34, 44],
      iconAnchor: [17, 42]
    });

    const marker = L.marker([startPos.lat, startPos.lng], {
      icon: pinIcon,
      draggable: true
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setCoords({ lat: pos.lat, lng: pos.lng });
      void resolveCoordsAddress(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCoords({ lat, lng });
      void resolveCoordsAddress(lat, lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    const timer = setTimeout(() => {
      map.invalidateSize();
      if (initialCoords) {
        void resolveCoordsAddress(initialCoords.lat, initialCoords.lng);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      try {
        map.remove();
      } catch {
        // ignore cleanup error
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const handleUseCurrentPosition = async () => {
    setGeoError('');
    setIsLocating(true);
    try {
      const pos = await getBrowserGeolocation();
      setCoords({ lat: pos.lat, lng: pos.lng });
      if (markerRef.current && mapRef.current) {
        markerRef.current.setLatLng([pos.lat, pos.lng]);
        mapRef.current.setView([pos.lat, pos.lng], 16, { animate: true });
      }
      await resolveCoordsAddress(pos.lat, pos.lng, pos.accuracy);
    } catch {
      setGeoError(
        'Impossible d’accéder à votre GPS. Touchez la carte manuellement pour placer le repère.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${
          fullWidth ? 'h-[94vh] sm:h-[86vh]' : 'max-w-lg h-[88vh] sm:h-[640px]'
        } ${pal.card} rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.85)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`px-4 py-3.5 border-b border-white/[0.08] flex items-center justify-between ${
            pal.isClient ? 'bg-[#0A0A0A]' : 'bg-[#080B09]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl ${pal.iconBox} ${pal.accentText} flex items-center justify-center shrink-0`}>
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-white truncate">Point de livraison sur carte</h3>
              <p className="text-[11px] text-white/60 truncate">
                {pal.isClient
                  ? 'Touchez la carte ou déplacez le repère orange'
                  : 'Touchez la carte ou déplacez le repère vert'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la carte"
            className="w-10 h-10 rounded-full bg-white/[0.07] hover:bg-white/[0.13] border border-white/10 flex items-center justify-center text-white/85"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Canvas */}
        <div className="relative flex-1 bg-[#070908]">
          <div ref={containerRef} className="w-full h-full" />

          <button
            type="button"
            onClick={handleUseCurrentPosition}
            disabled={isLocating}
            className={`absolute top-3 right-3 z-[500] min-h-[42px] px-3.5 py-2 rounded-full backdrop-blur-md ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center gap-2 shadow-[0_6px_20px_rgba(0,0,0,0.65)] transition active:scale-95 disabled:opacity-60`}
          >
            {isLocating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LocateFixed className="w-4 h-4" />
            )}
            <span>{isLocating ? 'Localisation...' : 'Ma position'}</span>
          </button>
        </div>

        {/* Resolved Summary + Confirm CTA */}
        <div
          className={`p-4 ${
            pal.isClient ? 'bg-[#0A0A0A]' : 'bg-[#080B09]'
          } border-t border-white/[0.08] space-y-3`}
        >
          {geoError && (
            <p className="text-[11px] text-amber-400 bg-amber-500/12 border border-amber-500/30 rounded-xl px-3 py-2">
              {geoError}
            </p>
          )}

          <div className={`p-3 rounded-2xl ${pal.innerWell} space-y-1`}>
            <div className="flex items-center justify-between text-[11px]">
              <span className={`font-extrabold ${pal.accentText}`}>
                {resolvedAddress.commune || 'Abidjan'}
                {resolvedAddress.quartier ? ` • ${resolvedAddress.quartier}` : ''}
              </span>
              <span className="font-mono text-white/45 tabular-nums">
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </span>
            </div>
            <p className="text-xs text-white/85 flex items-center gap-2">
              {isResolving ? (
                <>
                  <Loader2 className={`w-3.5 h-3.5 animate-spin ${pal.accentText} shrink-0`} />
                  <span>Recherche de l’adresse précise...</span>
                </>
              ) : (
                <span>{resolvedAddress.details}</span>
              )}
            </p>
          </div>

          <button
            type="button"
            disabled={isResolving}
            onClick={() =>
              onConfirmLocation({
                lat: coords.lat,
                lng: coords.lng,
                commune: resolvedAddress.commune,
                quartier: resolvedAddress.quartier || resolvedAddress.commune,
                details: resolvedAddress.details
              })
            }
            className={`w-full min-h-[50px] py-3 rounded-full ${pal.primaryBtn} font-black text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50`}
          >
            <Check className="w-4 h-4 stroke-[3.2]" />
            <span>Valider cette position</span>
          </button>
        </div>
      </div>
    </div>
  );
};
