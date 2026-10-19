// T035 (feature 022, US3 — FR-017): the reader picks the document by the app's language.
//
// Spanish renders Spanish, English renders English, and anything else falls back to Spanish — the
// brand's primary. The same date on both is enforced structurally in `shared/tests/legal.test.ts`;
// here it is checked on screen, because that is what a reader compares.
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@svtrip/core/i18n';
import { getLegalDocument } from '@svtrip/shared';
import { LegalScreen } from '../src/legal/LegalScreen';

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('es');
});

async function renderIn(language: string) {
  await i18n.changeLanguage(language);
  return render(
    <MemoryRouter>
      <LegalScreen documentId="privacy" />
    </MemoryRouter>,
  );
}

describe('the document follows the language (FR-017)', () => {
  it('Spanish shows the Spanish policy', async () => {
    await renderIn('es');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Política de privacidad');
  });

  it('English shows the English policy', async () => {
    await renderIn('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Privacy policy');
    expect(screen.queryByText('Política de privacidad')).toBeNull();
  });

  it('an unsupported language falls back to Spanish, never to nothing', async () => {
    await renderIn('fr');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Política de privacidad');
  });

  it('both languages show the same last-updated date', async () => {
    const date = getLegalDocument('privacy', 'es')!.updatedAt;
    await renderIn('es');
    expect(screen.getByText(new RegExp(date))).toBeTruthy();
    cleanup();
    await renderIn('en');
    expect(screen.getByText(new RegExp(date))).toBeTruthy();
  });
});
