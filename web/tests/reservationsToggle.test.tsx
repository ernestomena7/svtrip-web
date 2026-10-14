// T027 (feature 020, US1): the merchant's "Recibir reservas" switch.
//
// Four of these cases exist because of a MEASUREMENT rather than a guess:
//
//   - "off when the field is ABSENT" is the row that separates `=== true` from
//     `!== false`. All 33 live listings carry no `reservationsEnabled`, so the
//     two forms agree on every document that exists and disagree only on the
//     shape this feature creates. Reading absence as ON would turn reservations
//     on for the whole catalog, none of which has opening hours. It is the
//     MIRROR of 018's `covered !== false`, which is right there for the opposite
//     reason, and that is why neither can be written from habit.
//
//   - "the reason is stated BEFORE the tap" is FR-002's second half. Feature 010
//     shipped fully built and returned an empty picker because a silent
//     `permission-denied` looks exactly like nothing being wrong.
//
//   - "turning it OFF is never blocked" is 018's rule about putting an allow
//     beside every deny: a guard that also blocks the ordinary thing is a worse
//     bug than the hole it closes.
//
//   - "it is offered to an outdoor-activity listing" is research R2. Filtering
//     by `businessType` would hide this from *Apaneca Zipline Adventures*.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// `fireEvent`, not `@testing-library/user-event`: that package is NOT a
// dependency of this repo. Feature 019 wrote nine uses of it before noticing.
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { OpeningHour } from '@svtrip/shared';

const setEnabled = vi.fn();
vi.mock('@svtrip/core/apiClient', () => ({
  setReservationsEnabled: (...a: unknown[]) => setEnabled(...a),
}));

// The real Spanish strings, so a missing key fails here rather than rendering a
// key name into the UI.
import es from '../../core/src/locales/es.json';
function tr(key: string): string {
  return key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], es) as string;
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => tr(k) ?? k, i18n: { language: 'es' } }),
}));

const { ReservationsToggle } = await import('../src/business/ReservationsToggle');

const OPEN: OpeningHour[] = [{ day: 1, open: '09:00', close: '17:00', closed: false }];
const CLOSED_WEEK: OpeningHour[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  open: '09:00',
  close: '17:00',
  closed: true,
}));

// `web/vitest.config.ts` sets `globals: false` with no setup file, so Testing
// Library's automatic `afterEach(cleanup)` never registers. Without this every
// `getBy*` finds several. `taxonomyIcon.test.tsx` documents the same thing; the
// real fix belongs in the shared config and is out of scope here, because
// turning on `globals` changes how all fifteen web suites run.
afterEach(cleanup);
beforeEach(() => {
  setEnabled.mockReset().mockResolvedValue({ enabled: true });
});

describe('the default is OFF (FR-001, SC-007)', () => {
  it('reads OFF when `reservationsEnabled` is ABSENT', () => {
    render(
      <ReservationsToggle listingId="l1" enabled={undefined} openingHours={OPEN} onChanged={vi.fn()} />,
    );
    expect(screen.getByText(tr('reservations.merchant.toggleOff'))).toBeDefined();
    expect(screen.getByRole('button', { name: tr('reservations.merchant.toggle') })).toHaveProperty(
      'ariaPressed',
      'false',
    );
  });

  it('reads OFF when it is explicitly false', () => {
    render(
      <ReservationsToggle listingId="l1" enabled={false} openingHours={OPEN} onChanged={vi.fn()} />,
    );
    expect(screen.getByText(tr('reservations.merchant.toggleOff'))).toBeDefined();
  });

  it('reads ON only when it is explicitly true', () => {
    render(
      <ReservationsToggle listingId="l1" enabled={true} openingHours={OPEN} onChanged={vi.fn()} />,
    );
    expect(screen.getByText(tr('reservations.merchant.toggleOn'))).toBeDefined();
  });
});

describe('usable hours are required to turn it ON (FR-002, SC-008)', () => {
  it('states the reason and offers the editor BEFORE the merchant taps', () => {
    const goToHours = vi.fn();
    render(
      <ReservationsToggle
        listingId="l1"
        enabled={undefined}
        openingHours={[]}
        onChanged={vi.fn()}
        onGoToHours={goToHours}
      />,
    );
    expect(screen.getByText(tr('reservations.merchant.needsHours'))).toBeDefined();
    fireEvent.click(screen.getByText(tr('reservations.merchant.needsHoursCta')));
    expect(goToHours).toHaveBeenCalled();
  });

  it('does not let the merchant send a request that would be refused', () => {
    render(
      <ReservationsToggle listingId="l1" enabled={undefined} openingHours={[]} onChanged={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: tr('reservations.merchant.toggle') }));
    expect(setEnabled).not.toHaveBeenCalled();
  });

  it('treats a week of CLOSED days as no hours at all', () => {
    // The residual gap the Firestore rules cannot close — rules have no
    // predicate over an array's elements, so `size() > 0` is all they can say.
    // This is the UI half holding the line the rule cannot.
    render(
      <ReservationsToggle
        listingId="l1"
        enabled={undefined}
        openingHours={CLOSED_WEEK}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(tr('reservations.merchant.needsHours'))).toBeDefined();
  });

  it('allows it with one real open day', async () => {
    const onChanged = vi.fn();
    render(
      <ReservationsToggle listingId="l1" enabled={false} openingHours={OPEN} onChanged={onChanged} />,
    );
    fireEvent.click(screen.getByRole('button', { name: tr('reservations.merchant.toggle') }));
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith('l1', true));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(true));
  });
});

describe('turning it OFF is never blocked (FR-004)', () => {
  it('offers the switch even with empty hours, when it is currently ON', async () => {
    // A merchant whose hours were emptied must still be able to switch the
    // feature off. 018's reason for an allow beside each deny.
    const onChanged = vi.fn();
    render(
      <ReservationsToggle listingId="l1" enabled={true} openingHours={[]} onChanged={onChanged} />,
    );
    const btn = screen.getByRole('button', { name: tr('reservations.merchant.toggle') });
    expect(btn).toHaveProperty('disabled', false);
    fireEvent.click(btn);
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith('l1', false));
  });

  it('does not show the needs-hours explanation while it is ON', () => {
    render(
      <ReservationsToggle listingId="l1" enabled={true} openingHours={[]} onChanged={vi.fn()} />,
    );
    expect(screen.queryByText(tr('reservations.merchant.needsHours'))).toBeNull();
  });
});

describe('a failed save says which failure it was', () => {
  it('names the hours when the server refuses with `hours_unusable`', async () => {
    // The server checks too, because a client can post anything. When it
    // refuses for THIS reason the merchant can act on it, so it gets its own
    // message rather than the generic one.
    setEnabled.mockRejectedValue(Object.assign(new Error('x'), { code: 'hours_unusable' }));
    render(
      <ReservationsToggle listingId="l1" enabled={false} openingHours={OPEN} onChanged={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: tr('reservations.merchant.toggle') }));
    expect(await screen.findByText(tr('reservations.merchant.needsHours'))).toBeDefined();
  });

  it('falls back to the generic message for anything else, and does NOT flip the switch', async () => {
    setEnabled.mockRejectedValue(Object.assign(new Error('x'), { code: 'internal' }));
    const onChanged = vi.fn();
    render(
      <ReservationsToggle listingId="l1" enabled={false} openingHours={OPEN} onChanged={onChanged} />,
    );
    fireEvent.click(screen.getByRole('button', { name: tr('reservations.merchant.toggle') }));
    expect(await screen.findByText(tr('reservations.merchant.toggleFailed'))).toBeDefined();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByText(tr('reservations.merchant.toggleOff'))).toBeDefined();
  });
});

describe('the switch is NEVER filtered by businessType (research R2)', () => {
  it('is offered to a listing with no businessType passed at all', () => {
    // This component does not receive `businessType`, and that is the assertion:
    // there is no parameter through which a type filter could be applied. The
    // spec's own reasoning — that the other 20 catalog entries are "beaches,
    // volcanoes and towns" — is false: *Apaneca Zipline Adventures* and
    // *Bamboards Surf Academy* are among them, sorted as `outdoor-activity`, and
    // they are more obviously businesses that take bookings than a café is.
    render(
      <ReservationsToggle listingId="l1" enabled={undefined} openingHours={OPEN} onChanged={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: tr('reservations.merchant.toggle') })).toHaveProperty(
      'disabled',
      false,
    );
  });
});
