// Prerender the landing page to real HTML (feature 007, T052/T053).
//
// WHY THIS EXISTS
// A Vite SPA ships `<div id="root"></div>` and nothing else. That is exactly
// what a search crawler indexes and what a link preview shows when the page is
// pasted into WhatsApp — the two places a marketing page has to work. It is also
// what a visitor sees while the JavaScript downloads on a slow connection.
//
// Running the same React tree through `react-dom/server` puts the marketing copy
// and the metadata in the HTML file itself, so the page is readable before a
// single byte of JS executes (FR-008, FR-009a). The output is still plain static
// files with no server process required (FR-007).
//
// The showcase is deliberately absent from the prerendered markup: it depends on
// a network call, so it hydrates client-side and its absence is a non-event.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import i18n from '@svtrip/core/i18n';
import { App } from './src/App';

// Resolved from the workspace root, not from this file: Vite compiles this
// script into `dist-ssr/` (see the note in package.json's build script), so
// `import.meta.url` would point one directory too deep.
const dist = resolve(process.cwd(), 'dist');

/** ES is the default document; EN is a real sibling, not a client-side toggle. */
const LANGUAGES = [
  { code: 'es', file: 'index.html', path: '/' },
  { code: 'en', file: 'en.html', path: '/en.html' },
] as const;

const SITE_URL = process.env.LANDING_SITE_URL ?? 'https://svtrip.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function head(lang: string, title: string, description: string, canonical: string): string {
  const alternates = LANGUAGES.map(
    (l) => `<link rel="alternate" hreflang="${l.code}" href="${SITE_URL}${l.path}" />`,
  ).join('\n    ');

  return `<title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonical}" />
    ${alternates}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="SVTrip" />
    <meta property="og:locale" content="${lang === 'es' ? 'es_SV' : 'en_US'}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SITE_URL}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_URL}/og-image.png" />`;
}

// Wrapped rather than using top-level await: this file is compiled by Vite's
// SSR build, whose default target does not allow it.
async function main(): Promise<void> {
  const template = readFileSync(resolve(dist, 'index.html'), 'utf8');

  for (const { code, file, path } of LANGUAGES) {
    await i18n.changeLanguage(code);
    const body = renderToString(createElement(App));

    const title = i18n.t('landing.meta.title');
    const description = i18n.t('landing.meta.description');

    const html = template
      .replace('<html lang="es">', `<html lang="${code}">`)
      // Replace the placeholder head metadata wholesale rather than appending, so
      // the development-time title never ships alongside the real one.
      .replace(
        /<title>[\s\S]*?<\/title>\s*<meta name="description"[^>]*\/>/,
        head(code, title, description, `${SITE_URL}${path}`),
      )
      .replace('<div id="root"></div>', `<div id="root">${body}</div>`);

    if (html.includes('<div id="root"></div>')) {
      throw new Error(`prerender produced an empty root for ${file} — the page would ship blank`);
    }

    writeFileSync(resolve(dist, file), html, 'utf8');
    console.log(`prerendered ${file} (${code}) — ${(html.length / 1024).toFixed(1)} kB`);
  }
}

void main().catch((err) => {
  console.error('[landing] prerender failed:', err);
  process.exit(1);
});
