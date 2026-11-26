// Feature 025 (T020, T039 later): the merchant page is real HTML, in both languages, and FAILS CLOSED.
//
// Reads the BUILT output, like prerender.test.ts: what can break is the build pipeline, and an
// in-memory render would pass while the shipped file was wrong.
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const built = (file: string) => readFileSync(resolve(dist, file), 'utf8');

/** Anything that would be a promise about the promotion or a price. */
// The LAUNCH offer's own words. Not "promoción": merchants publishing their own promotions is a benefit
// the page rightly names, and the first version of this list flagged it.
const PROMOTION = [/gratis/i, /\bfree\b/i, /premium/i, /3 meses/i, /3 months/i, /\$\s?\d/];

describe('the merchant page, as shipped', () => {
  beforeAll(() => {
    if (!existsSync(resolve(dist, 'negocios.html'))) {
      throw new Error('dist/negocios.html missing — run `npm run build --workspace landing` first');
    }
  });

  it('exists in both languages as real HTML, not an empty shell', () => {
    for (const file of ['negocios.html', 'en/business.html']) {
      expect(built(file), file).not.toContain('<div id="root"></div>');
    }
  });

  it('says "Estamos afiliando comercios" and links the CTA to the web app form with the language', () => {
    const es = built('negocios.html');
    expect(es).toContain('Estamos afiliando comercios');
    expect(es).toMatch(/href="[^"]*\/negocios\/registro\?lang=es"/);
    const en = built('en/business.html');
    expect(en).toContain('We are onboarding businesses');
    expect(en).toMatch(/href="[^"]*\/en\/business\/register\?lang=en"/);
  });

  it('names the document language', () => {
    expect(built('negocios.html')).toContain('<html lang="es">');
    expect(built('en/business.html')).toContain('<html lang="en">');
  });

  it('FAILS CLOSED: no promotion and no price in the prerendered HTML, in either language (FR-007)', () => {
    for (const file of ['negocios.html', 'en/business.html']) {
      const body = built(file).split('<div id="root">')[1] ?? '';
      for (const pattern of PROMOTION) expect(body, `${file} matches ${pattern}`).not.toMatch(pattern);
    }
  });

  it('promises no app-store date (FR-002)', () => {
    const body = built('negocios.html').split('<div id="root">')[1] ?? '';
    expect(body).not.toMatch(/\b(enero|febrero|marzo|diciembre|2026|2027)\b/i);
  });

  it('shows the SVTrip contact', () => {
    expect(built('negocios.html')).toMatch(/mailto:[^"]+@svtrip\.com/);
  });
});
