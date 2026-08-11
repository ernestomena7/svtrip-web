// The prerender must produce real HTML (feature 007, T058 — FR-008, FR-005).
//
// This is the assertion that keeps the landing page's entire reason for existing
// intact. A Vite SPA ships `<div id="root"></div>`; that empty shell is what a
// search crawler indexes and what WhatsApp shows when someone pastes the link.
// The failure is completely invisible in a browser — the page looks perfect,
// because the browser runs the JavaScript that a crawler does not.
//
// Reads the BUILT output rather than rendering in-process, on purpose: the thing
// that can break is the build pipeline (the SSR pass, the template replacement,
// the Node target), and a test that re-renders in memory would pass while the
// shipped file was blank.
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const built = (file: string) => readFileSync(resolve(dist, file), 'utf8');

describe('prerendered output', () => {
  beforeAll(() => {
    if (!existsSync(resolve(dist, 'index.html'))) {
      throw new Error('dist/index.html missing — run `npm run build --workspace landing` first');
    }
  });

  it('does not ship an empty root element', () => {
    for (const file of ['index.html', 'en.html']) {
      expect(built(file), `${file} shipped an empty shell`).not.toContain('<div id="root"></div>');
    }
  });

  it('contains the marketing copy as real text, not just as a script payload', () => {
    const es = built('index.html');
    // The headline, the value proposition and the call to action — the three
    // things a visitor must be able to read before any JavaScript runs.
    expect(es).toContain('¿Qué hacemos hoy?');
    expect(es).toContain('Playas, volcanes, pueblos coloniales');
    expect(es).toContain('Empezar');
  });

  it('carries the metadata a search result and a link preview need', () => {
    const es = built('index.html');
    expect(es).toMatch(/<title>SVTrip[^<]*<\/title>/);
    expect(es).toMatch(/<meta name="description" content="[^"]{40,}"/);
    expect(es).toMatch(/<meta property="og:title"/);
    expect(es).toMatch(/<meta property="og:description"/);
    expect(es).toMatch(/<meta property="og:image"/);
    expect(es).toMatch(/<meta name="twitter:card"/);
    expect(es).toMatch(/<link rel="canonical"/);
    // The development-time placeholder title must not survive into the build.
    expect((es.match(/<title>/g) ?? []).length).toBe(1);
  });

  it('ships both languages at full parity, each in its own language', () => {
    const es = built('index.html');
    const en = built('en.html');

    expect(es).toContain('<html lang="es"');
    expect(en).toContain('<html lang="en"');

    expect(en).toContain('What should we do today?');
    expect(en).toContain('Get started');
    // Not merely a copy of the Spanish document with a different lang attribute.
    expect(en).not.toContain('¿Qué hacemos hoy?');

    // Both are discoverable as alternates of each other, or the English page is
    // invisible to search no matter how good it is.
    expect(es).toMatch(/hreflang="en"/);
    expect(en).toMatch(/hreflang="es"/);
  });

  it('is deployable as static files with no server process', () => {
    // FR-007: shared hosting is the target, so everything the page needs must be
    // a file on disk. A `.htaccess` or rewrite rule is not required here because
    // the landing is a single document, unlike the SPA.
    expect(existsSync(resolve(dist, 'index.html'))).toBe(true);
    expect(existsSync(resolve(dist, 'en.html'))).toBe(true);
    expect(existsSync(resolve(dist, 'svtrip-wordmark.png'))).toBe(true);
    expect(existsSync(resolve(dist, 'og-image.png'))).toBe(true);
  });
});
