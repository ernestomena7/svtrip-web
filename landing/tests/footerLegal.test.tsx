// T032 (feature 022, FR-014): the landing footer links OUT to the web app's public legal routes.
//
// The landing hosts no copy of either document — one source of truth — so what is asserted is that
// both links exist, point at the web app's origin (`APP_URL`, the same value the CTA uses) and land on
// the two public routes `web/tests/legalRoutes.test.tsx` proves are served with no account.
// Whether `APP_URL` is SET in the production build cannot be proven here; T045 reads the live
// address back from outside for that reason.
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@svtrip/core/i18n';
import { Footer } from '../src/sections/Footer';
import { APP_URL } from '../src/config';

// Explicit, because this workspace runs vitest with `globals: false`.
afterEach(cleanup);

describe('footer legal links (FR-014)', () => {
  it('links both documents on the web app, not on the landing', () => {
    render(<Footer />);
    const privacy = screen.getByRole('link', { name: 'Política de privacidad' });
    const terms = screen.getByRole('link', { name: 'Términos de servicio' });
    expect(privacy.getAttribute('href')).toBe(`${APP_URL}/privacidad`);
    expect(terms.getAttribute('href')).toBe(`${APP_URL}/terminos`);
  });
});
