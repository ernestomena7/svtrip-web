// @vitest-environment jsdom
// Feature 025 (T029a, FR-004): one name per plan. A name stored in `subscription_plans.name_i18n`
// ("Standard") must reach the plan slot AND the sentences that used to write "Básico" into their prose —
// otherwise the public page and the app name the same plan differently.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import '../src/i18n';

const fetchPlans = vi.fn();
vi.mock('../src/apiClient', () => ({ fetchPlans: () => fetchPlans() }));

const { usePlanName, resetPlanNames } = await import('../src/repos/planNames');
const { useUiStore } = await import('../src/uiStore');

function Probe() {
  const { t } = useTranslation();
  const planName = usePlanName();
  return (
    <div>
      <p data-testid="slot">{planName('basico')}</p>
      <p data-testid="sentence">{t('subscription.secondPlaceNeedsPremium', { plan: planName('basico') })}</p>
    </div>
  );
}

beforeEach(() => {
  resetPlanNames();
  fetchPlans.mockReset();
  useUiStore.getState().setLanguage('es');
});
afterEach(cleanup);

describe('usePlanName', () => {
  it('the stored name wins, in the plan slot and inside the sentence', async () => {
    fetchPlans.mockResolvedValue({ plans: [{ code: 'basico', monthlyPriceUsd: 30, launchDiscountPercent: 100, nameI18n: { es: 'Standard', en: 'Standard' } }], campaign: {} });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('slot').textContent).toBe('Standard'));
    expect(screen.getByTestId('sentence').textContent).toBe('Standard cubre un solo lugar. Pasá a Premium para agregar otro.');
  });

  it('no stored name → the locale name, in both places (the fallback beside the override)', async () => {
    fetchPlans.mockResolvedValue({ plans: [{ code: 'basico', monthlyPriceUsd: 30, launchDiscountPercent: 100 }], campaign: {} });
    render(<Probe />);
    await waitFor(() => expect(fetchPlans).toHaveBeenCalled());
    expect(screen.getByTestId('slot').textContent).toBe('Básico');
    expect(screen.getByTestId('sentence').textContent).toMatch(/^Básico cubre un solo lugar/);
  });

  it('a failed catalog load keeps the locale name and never throws', async () => {
    fetchPlans.mockRejectedValue(new Error('offline'));
    render(<Probe />);
    await waitFor(() => expect(fetchPlans).toHaveBeenCalled());
    expect(screen.getByTestId('slot').textContent).toBe('Básico');
  });

  it('follows the language', async () => {
    useUiStore.getState().setLanguage('en');
    fetchPlans.mockResolvedValue({ plans: [{ code: 'basico', monthlyPriceUsd: 30, launchDiscountPercent: 100, nameI18n: { es: 'Estándar', en: 'Standard' } }], campaign: {} });
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('slot').textContent).toBe('Standard'));
  });
});
