// The business-profile location map (feature 008, US1/US2).
//
// The assertion that earns its place here is the FAILURE one. A map that draws
// when the tiles load is easy; what this feature promised is that a map which
// CANNOT load disappears completely — no error box, no empty grey frame — while
// the rest of the profile carries on (FR-006). That is invisible in a happy-path
// screenshot and is exactly the kind of thing that quietly regresses.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@svtrip/core/i18n';

const addTo = vi.fn();
const setLngLat = vi.fn(() => ({ addTo }));
const mapOn = vi.fn();
const mapRemove = vi.fn();
/** Flipped per-test to simulate WebGL/tile-host failure at construct time. */
let constructorThrows = false;

vi.mock('maplibre-gl', () => ({
  Map: class {
    constructor() {
      if (constructorThrows) throw new Error('WebGL unavailable');
    }
    on = mapOn;
    remove = mapRemove;
  },
  Marker: class {
    setLngLat = setLngLat;
  },
  setWorkerUrl: vi.fn(),
}));

// Vite resolves this to a bundled worker file; under vitest it is just a string.
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: 'worker.js' }));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

const { LocationPreviewMap } = await import('../src/traveler/LocationPreviewMap');

afterEach(() => {
  cleanup();
  constructorThrows = false;
  vi.clearAllMocks();
});

describe('LocationPreviewMap', () => {
  it('renders a labelled map region for a real location', () => {
    render(<LocationPreviewMap lat={13.4948} lng={-89.3829} />);

    // Labelled, because MapLibre draws into a <canvas> that carries no
    // accessible name of its own — without this the region is a dead zone.
    expect(screen.getByRole('application')).toBeDefined();
  });

  it('drops a single marker at the given coordinates', () => {
    render(<LocationPreviewMap lat={13.4948} lng={-89.3829} />);

    // GeoJSON order is [lng, lat]. Reversing them puts every business in the
    // ocean off Somalia, and it fails silently — the pin just lands wrong.
    expect(setLngLat).toHaveBeenCalledWith([-89.3829, 13.4948]);
    expect(setLngLat).toHaveBeenCalledTimes(1);
  });

  it('renders NOTHING when the map cannot be constructed (FR-006)', () => {
    constructorThrows = true;
    const { container } = render(<LocationPreviewMap lat={13.4948} lng={-89.3829} />);

    // Not an error message, not a grey placeholder box — absent. Anything else
    // reads as "this business failed to load" rather than "no map today".
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('application')).toBeNull();
  });

  it('subscribes to runtime tile errors, not just construction failure', () => {
    render(<LocationPreviewMap lat={13.4948} lng={-89.3829} />);

    // Tiles that 404 or time out AFTER a successful construct arrive here. A
    // component that only guarded the constructor would leave a blank canvas
    // sitting in the layout instead of removing itself.
    expect(mapOn).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
