// Where a business actually is, on the desktop profile (feature 008, US2 —
// FR-001, FR-002, FR-003, FR-005, FR-006).
//
// The desktop twin of `client/src/features/place-profile/LocationPreviewMap.tsx`.
// Same behaviour, same brand marker, same hide-on-failure rule — deliberately
// NOT shared through `core/`, because each surface's MapLibre worker fix lives
// in its own `vite.config.ts` and `business/LocationPicker.tsx` is already
// duplicated per surface for that same reason (specs/008 research R1).
//
// Read-only: no draggable marker, no click-to-relocate, no address search. A
// traveler has nothing to save.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(maplibreWorkerUrl);

const STYLE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/bright';

export function LocationPreviewMap({ lat, lng }: { lat: number; lng: number }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: STYLE_URL,
        center: [lng, lat],
        zoom: 14,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed(true);
      return;
    }

    map.on('error', () => setFailed(true));

    // Collapse the attribution behind its (i) button on first paint — see the
    // note on the mobile twin. The attribution stays (OSM licence); only its
    // default open state changes, and it matters more here: this rail is
    // narrower, so expanded attribution covered nearly half the map.
    map.on('load', () => {
      map
        .getContainer()
        .querySelector('.maplibregl-ctrl-attrib')
        ?.classList.remove('maplibregl-compact-show');
    });

    new Marker({ color: '#F02828' }).setLngLat([lng, lat]).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  // Hidden outright when the tiles cannot load — no error box, no empty frame
  // (FR-006). Everything else in this rail, "Cómo llegar" included, is unaffected.
  if (failed) return null;

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={t('profile.map.label')}
      className="h-44 w-full overflow-hidden rounded-md bg-surface-2"
    />
  );
}
