import type { Express, Request, Response } from 'express';

export function getGoogleMapsConfig() {
  const serverKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  const clientKey = (process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  return {
    configured: Boolean(serverKey || clientKey),
    serverKey: serverKey || clientKey,
    clientConfigured: Boolean(clientKey),
    envVar: 'GOOGLE_MAPS_API_KEY'
  };
}

export async function reverseGeocodeWithGoogleMaps(lat: number, lng: number): Promise<{
  ok: boolean;
  configured: boolean;
  formattedAddress?: string;
  street?: string;
  quartier?: string;
  commune?: string;
  city?: string;
  country?: string;
  error?: string;
}> {
  const cfg = getGoogleMapsConfig();
  if (!cfg.serverKey) {
    return { ok: false, configured: false, error: 'GOOGLE_MAPS_NOT_CONFIGURED' };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
      `${lat},${lng}`
    )}&language=fr&region=ci&key=${encodeURIComponent(cfg.serverKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok || (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS')) {
      return {
        ok: false,
        configured: true,
        error: String(data.status || `HTTP_${res.status}`)
      };
    }

    const first = Array.isArray(data.results) ? data.results[0] : null;
    if (!first) {
      return { ok: false, configured: true, error: 'ZERO_RESULTS' };
    }

    const comps: Array<{ long_name: string; types: string[] }> = Array.isArray(first.address_components)
      ? first.address_components
      : [];
    const findType = (t: string) => comps.find((c) => Array.isArray(c.types) && c.types.includes(t))?.long_name || '';

    const streetNumber = findType('street_number');
    const route = findType('route');
    const street = [streetNumber, route].filter(Boolean).join(' ');
    const quartier = findType('sublocality_level_2') || findType('neighborhood') || findType('sublocality_level_1');
    const commune = findType('sublocality_level_1') || findType('sublocality') || findType('administrative_area_level_2');
    const city = findType('locality') || findType('administrative_area_level_1') || 'Abidjan';
    const country = findType('country') || 'Côte d’Ivoire';

    return {
      ok: true,
      configured: true,
      formattedAddress: String(first.formatted_address || [street, quartier, city].filter(Boolean).join(', ')),
      street,
      quartier,
      commune: commune || 'Cocody',
      city,
      country
    };
  } catch (err) {
    return { ok: false, configured: true, error: (err as Error).message };
  }
}

export async function computeGoogleRoute(params: {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  travelMode?: 'DRIVE' | 'TWO_WHEELER';
}): Promise<{
  ok: boolean;
  configured: boolean;
  distanceMeters?: number;
  durationSeconds?: number;
  encodedPolyline?: string;
  error?: string;
}> {
  const cfg = getGoogleMapsConfig();
  if (!cfg.serverKey) {
    return { ok: false, configured: false, error: 'GOOGLE_MAPS_NOT_CONFIGURED' };
  }

  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': cfg.serverKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: params.originLat, longitude: params.originLng } } },
        destination: { location: { latLng: { latitude: params.destLat, longitude: params.destLng } } },
        travelMode: params.travelMode || 'TWO_WHEELER',
        routingPreference: 'TRAFFIC_AWARE',
        languageCode: 'fr-FR',
        units: 'METRIC'
      }),
      signal: AbortSignal.timeout(6000)
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, any>;
    if (!response.ok) {
      return { ok: false, configured: true, error: String(data?.error?.message || `HTTP_${response.status}`) };
    }

    const route = Array.isArray(data.routes) ? data.routes[0] : null;
    if (!route) {
      return { ok: false, configured: true, error: 'NO_ROUTE_FOUND' };
    }

    const durationRaw = String(route.duration || '0s');
    const durationSeconds = parseInt(durationRaw.replace(/[^\d]/g, ''), 10) || 0;
    return {
      ok: true,
      configured: true,
      distanceMeters: Number(route.distanceMeters || 0),
      durationSeconds,
      encodedPolyline: route.polyline?.encodedPolyline
    };
  } catch (err) {
    return { ok: false, configured: true, error: (err as Error).message };
  }
}

export function installGoogleMapsRoutes(app: Express) {
  app.get('/api/maps/status', (_req: Request, res: Response) => {
    const cfg = getGoogleMapsConfig();
    res.json({
      success: true,
      configured: cfg.configured,
      clientConfigured: cfg.clientConfigured
    });
  });

  app.post('/api/maps/reverse-geocode', async (req: Request, res: Response) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ success: false, error: 'INVALID_COORDINATES' });
      return;
    }
    const result = await reverseGeocodeWithGoogleMaps(lat, lng);
    if (!result.ok) {
      res.status(result.configured ? 502 : 503).json({
        success: false,
        configured: result.configured,
        error: result.error
      });
      return;
    }
    res.json({ success: true, ...result });
  });

  app.post('/api/maps/routes', async (req: Request, res: Response) => {
    const originLat = Number(req.body?.originLat);
    const originLng = Number(req.body?.originLng);
    const destLat = Number(req.body?.destLat);
    const destLng = Number(req.body?.destLng);
    const travelMode = req.body?.travelMode === 'DRIVE' ? 'DRIVE' : 'TWO_WHEELER';
    if (
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLng) ||
      !Number.isFinite(destLat) ||
      !Number.isFinite(destLng)
    ) {
      res.status(400).json({ success: false, error: 'INVALID_COORDINATES' });
      return;
    }
    const result = await computeGoogleRoute({ originLat, originLng, destLat, destLng, travelMode });
    if (!result.ok) {
      res.status(result.configured ? 502 : 503).json({
        success: false,
        configured: result.configured,
        error: result.error
      });
      return;
    }
    res.json({ success: true, ...result });
  });
}
