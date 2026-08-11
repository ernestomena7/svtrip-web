// Where the business is (feature 007, T104 — FR-033, FR-034).
//
// Address search or a draggable pin, with typed coordinates as the escape hatch.
// That fallback is not redundancy for its own sake: it is the only way in when
// the map cannot load, and this project has watched the map fail to load in
// three different ways already.
//
// TWO MAPLIBRE TRAPS, both of which render a map with its background and pin but
// NO roads, water or labels, and both entirely silent because a worker that dies
// on startup reports nothing:
//
//   1. Vite's dependency pre-bundler mangles the worker entry in dev. Handled by
//      `optimizeDeps.exclude` in vite.config.ts.
//   2. The worker `import`s a sibling `maplibre-gl-shared.mjs`. Bundling it with
//      `?worker&url` (NOT plain `?url`, which copies one file and leaves that
//      import dangling) plus `worker.format: 'iife'` produces one self-contained
//      file with nothing left to resolve at runtime.
//
// Both cost days to diagnose on the mobile app. They are carried across rather
// than rediscovered.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { isValidLat, isValidLng } from '@svtrip/shared';
import { postJson } from '@svtrip/core/apiClient';
import { Button, Field, TextInput } from '../components/ui';

// Module scope, once, before any Map is constructed.
setWorkerUrl(maplibreWorkerUrl);

/** Where the map opens before a business has a location of its own. */
const DEFAULT_CENTER = { lat: 13.6962, lng: -89.2015 };

const STYLE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/bright';

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: string;
  lng: string;
  onChange: (next: { lat: string; lng: string }) => void;
}) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const hasPoint = isValidLat(Number(lat)) && isValidLng(Number(lng));
  const point = hasPoint ? { lat: Number(lat), lng: Number(lng) } : DEFAULT_CENTER;

  // Set up once; the marker moves imperatively afterwards so a React re-render
  // never tears down and rebuilds the map.
  useEffect(() => {
    if (!container.current || map.current) return;
    try {
      const instance = new MapLibreMap({
        container: container.current,
        style: STYLE_URL,
        center: [point.lng, point.lat],
        zoom: hasPoint ? 15 : 12,
      });
      instance.on('error', () => setMapFailed(true));

      const pin = new Marker({ color: '#F02828', draggable: true })
        .setLngLat([point.lng, point.lat])
        .addTo(instance);

      pin.on('dragend', () => {
        const { lat: y, lng: x } = pin.getLngLat();
        onChange({ lat: y.toFixed(6), lng: x.toFixed(6) });
      });

      instance.on('click', (e) => {
        pin.setLngLat(e.lngLat);
        onChange({ lat: e.lngLat.lat.toFixed(6), lng: e.lngLat.lng.toFixed(6) });
      });

      map.current = instance;
      marker.current = pin;
    } catch {
      setMapFailed(true);
    }
    return () => {
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // Intentionally once: re-running would recreate the map on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin in step when the coordinates change from outside (the typed
  // fallback, or a search result).
  useEffect(() => {
    if (!map.current || !marker.current || !hasPoint) return;
    marker.current.setLngLat([Number(lng), Number(lat)]);
    map.current.easeTo({ center: [Number(lng), Number(lat)] });
  }, [lat, lng, hasPoint]);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      // Geocoding goes through the BFF: the provider key is a secret and must
      // never reach a browser bundle (Constitution I).
      const res = await postJson<{ results: GeocodeResult[] }>('/geocode', { query });
      setResults(res.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function choose(result: GeocodeResult) {
    onChange({ lat: result.lat.toFixed(6), lng: result.lng.toFixed(6) });
    setResults(null);
    setQuery(result.label);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-muted">{t('services.location')}</p>

      <div className="flex gap-2">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          placeholder={t('services.addressPlaceholder')}
        />
        <Button variant="secondary" iconLeft="search" disabled={searching} onClick={() => void search()}>
          {searching ? t('common.loading') : t('services.searchAddress')}
        </Button>
      </div>

      {results && results.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}`}>
              <button
                type="button"
                onClick={() => choose(result)}
                className="w-full px-3.5 py-2.5 text-left text-sm text-text transition hover:bg-surface-2"
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length === 0 && (
        <p className="text-sm text-muted">{t('services.addressNoResults')}</p>
      )}

      <div
        ref={container}
        className="h-[360px] w-full overflow-hidden rounded-lg border border-border"
        aria-label={t('services.map')}
      />
      {mapFailed && <p className="text-xs text-muted">{t('services.mapUnavailable')}</p>}

      {/* The escape hatch. Also how an owner verifies the pin landed where they
          meant — a map is persuasive even when it is wrong. */}
      <details className="rounded-md bg-surface-2 px-3.5 py-2.5">
        <summary className="cursor-pointer text-sm font-bold text-text">
          {t('services.enterCoordinates')}
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label={t('services.latitude')}>
            <TextInput
              inputMode="decimal"
              value={lat}
              onChange={(e) => onChange({ lat: e.target.value, lng })}
            />
          </Field>
          <Field label={t('services.longitude')}>
            <TextInput
              inputMode="decimal"
              value={lng}
              onChange={(e) => onChange({ lat, lng: e.target.value })}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}
