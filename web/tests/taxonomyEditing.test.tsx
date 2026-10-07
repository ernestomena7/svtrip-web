// Feature 019: editing a taxonomy entry that already exists.
//
// THIS IS `TaxonomyScreen`'S FIRST TEST. The screen shipped at feature 010 and
// has had none since — and the visual gate cannot stand in for one here, because
// it photographs four MOBILE screens while this one is web-only (research R3).
// Same conclusion feature 017 reached for `BottomNav`: when a screenshot cannot
// carry the claim, a test that asserts behaviour has to.
//
// WHAT EACH CASE BELOW GUARDS is named in `contracts/edit-ui.md` as one of eight
// obligations. The sabotage that reddens each one is recorded in tasks.md.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// `fireEvent`, not `@testing-library/user-event`: that package is NOT a
// dependency of this repo, and the plan adds none. Every existing suite in
// `web/tests/` drives the DOM this way.
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

// --- The taxonomy hook and the BFF client are stubbed. This suite is about what
// --- the SCREEN sends and renders, not about Firestore or the network.
const entries = vi.fn();
const reload = vi.fn();
vi.mock('@svtrip/core/taxonomy/useTaxonomy', () => ({
  useTaxonomy: () => ({ entries: entries(), loading: false, reload }),
  useMergedTaxonomy: () => ({ options: [], loading: false }),
}));

const patchJson = vi.fn();
const postJson = vi.fn();
vi.mock('@svtrip/core/apiClient', () => ({
  patchJson: (...a: unknown[]) => patchJson(...a),
  postJson: (...a: unknown[]) => postJson(...a),
  getJson: vi.fn(),
}));

vi.mock('@svtrip/core/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'admin' }, profile: null, loading: false }),
}));

// `t` resolves against the REAL Spanish locale file, not a hand-written map.
//
// A map would make these pass even if a key did not exist or had lost an accent
// — the defect feature 016 shipped as "Segun la guia" and only an e2e searching
// for the rendered string caught.
import es from '@svtrip/core/locales/es.json';

function lookup(key: string): string | undefined {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], es) as
    | string
    | undefined;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const raw = lookup(key);
      if (raw === undefined) return key;
      if (!opts) return raw;
      return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(opts[name] ?? ''));
    },
    i18n: { language: 'es' },
  }),
}));

vi.mock('../src/shell/DesktopLayout', () => ({
  DesktopLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { TaxonomyRow } = await import('../src/admin/TaxonomyRow');

/**
 * THE DEFAULT FIXTURE IS AN ENTRY WITH NO OVERRIDE DOCUMENT.
 *
 * Measured: 58 of 63 entries are in that state, so it is the path 92% of edits
 * take. Making the exceptional case the default fixture is how a suite ends up
 * proving the path almost nobody walks.
 */
function renderRow(
  overrides: Partial<Parameters<typeof TaxonomyRow>[0]> = {},
  entry: unknown = undefined,
) {
  const props = {
    vocabulary: 'business-types' as const,
    entryKey: 'restaurant-cafe',
    entry: entry as never,
    isBuiltIn: true,
    active: true,
    language: 'es' as const,
    busy: false,
    editing: false,
    onToggle: vi.fn(),
    onEditOpen: vi.fn(),
    onEditClose: vi.fn(),
    onSaved: vi.fn(),
    ...overrides,
  };
  const utils = render(
    <ul>
      <TaxonomyRow {...props} />
    </ul>,
  );
  return { ...utils, props };
}

/**
 * The icon input, by PLACEHOLDER rather than by label.
 *
 * `IconField` wraps its input in a `<label>` whose text is "Ícono", but
 * `getByLabelText` does not resolve it — `taxonomyIcon.test.tsx` reaches the
 * same input with `getByRole('textbox')` for the same reason. That query is
 * ambiguous HERE, because the open row has three textboxes, so the placeholder
 * is what identifies this one unambiguously.
 */
const iconField = () => screen.getByPlaceholderText('beach_access');

/** An entry that HAS been edited before, for the cases that need a loaded value. */
const EDITED = {
  key: 'restaurant-cafe',
  labelI18n: { es: 'Comida', en: 'Food' },
  icon: 'restaurant',
  active: true,
  createdAt: 1,
};

// EXPLICIT CLEANUP, and it is not boilerplate.
//
// `web/vitest.config.ts` sets `globals: false` and there is no setup file, so
// Testing Library's automatic `afterEach(cleanup)` never registers and the DOM
// ACCUMULATES across every test in a file. Without this, the third case here
// finds three inputs, one still holding the previous test's value.
//
// This was NOT discovered by feature 019: `taxonomyIcon.test.tsx` already says
// it — "without an explicit cleanup they stack up in the document and every
// getBy* finds several". Repeating the line rather than linking it is how the
// next suite will rediscover it a third time, so: the fix belongs in the shared
// config, and is left out of this feature because turning on `globals` changes
// how all fourteen web suites run.
afterEach(cleanup);

beforeEach(() => {
  entries.mockReset().mockReturnValue([]);
  reload.mockReset();
  patchJson.mockReset().mockResolvedValue({});
  postJson.mockReset().mockResolvedValue({});
});

describe('the row opens and closes', () => {
  it('shows an edit control when closed, and no fields', () => {
    renderRow();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
    expect(screen.queryByLabelText('Nombre (Español)')).toBeNull();
  });

  // Obligation 1.
  it('cancelling closes the row and writes NOTHING', () => {
    const { props } = renderRow({ editing: true });

    fireEvent.change(screen.getByLabelText('Nombre (Español)'), {
      target: { value: 'Algo distinto' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(props.onEditClose).toHaveBeenCalled();
    // The assertion that matters: a cancel is not a quiet save.
    expect(patchJson).not.toHaveBeenCalled();
  });

  // Obligation 7 — the half a row can be responsible for. The other half (only
  // one key open at a time) lives in the screen and is asserted below.
  it('hides the edit control while the row is already open', () => {
    renderRow({ editing: true });
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
  });
});

describe('what a save sends', () => {
  // Obligation 2.
  it('sends BOTH languages, even when only one was changed', async () => {
    renderRow({ editing: true });

    fireEvent.change(screen.getByLabelText('Nombre (Español)'), {
      target: { value: 'Comedor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patchJson).toHaveBeenCalled());
    const [, body] = patchJson.mock.calls[0] as [string, { labelI18n?: { es: string; en: string } }];
    expect(body.labelI18n?.es).toBe('Comedor');
    // The English was NOT touched by the operator and is sent anyway, because
    // `labelI18n` accepts no less. This is what FR-005b warns about on screen.
    expect(typeof body.labelI18n?.en).toBe('string');
    expect(body.labelI18n?.en.length).toBeGreaterThan(0);
  });

  // Obligation 4.
  it('NEVER sends `active` — deactivation is a different control', async () => {
    renderRow({ editing: true });

    fireEvent.change(screen.getByLabelText('Nombre (Español)'), {
      target: { value: 'Comedor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patchJson).toHaveBeenCalled());
    const [, body] = patchJson.mock.calls[0] as [string, Record<string, unknown>];
    expect('active' in body).toBe(false);
  });

  it('addresses the entry by its key, which is never editable', async () => {
    renderRow({ editing: true });

    fireEvent.change(screen.getByLabelText('Nombre (Español)'), {
      target: { value: 'Comedor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patchJson).toHaveBeenCalled());
    const [url] = patchJson.mock.calls[0] as [string];
    expect(url).toContain('/admin/taxonomy/business-types/restaurant-cafe');
  });
});

describe('what the row refuses to send', () => {
  // Obligation 6.
  it('disables Save until something actually changed', () => {
    renderRow({ editing: true }, EDITED);
    expect(screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled')).toBe(true);
  });

  it('disables Save when either language is blank, and says why', async () => {
    renderRow({ editing: true }, EDITED);

    fireEvent.change(screen.getByLabelText('Nombre (Español)'), { target: { value: '' } });

    expect(screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Escribí el nombre en los dos idiomas.')).toBeTruthy();
  });
});

describe('the prefill, which is what 58 of 63 entries depend on', () => {
  // Obligation 8.
  it('fills BOTH fields on an entry that has no override document', () => {
    renderRow({ editing: true });
    // The key resolves through the real locale file, so these are the shipped
    // translations — not blanks, which is what reading `labelI18n` would give.
    expect((screen.getByLabelText('Nombre (Español)') as HTMLInputElement).value.length)
      .toBeGreaterThan(0);
    expect((screen.getByLabelText('Nombre (English)') as HTMLInputElement).value.length)
      .toBeGreaterThan(0);
  });

  it('fills from the stored labels when the entry HAS been edited before', () => {
    renderRow({ editing: true }, EDITED);
    expect((screen.getByLabelText('Nombre (Español)') as HTMLInputElement).value).toBe('Comida');
    expect((screen.getByLabelText('Nombre (English)') as HTMLInputElement).value).toBe('Food');
  });

  it('states that an edited entry stops following the product translations', () => {
    renderRow({ editing: true });
    expect(screen.getByText(/deja de seguir las traducciones del producto/)).toBeTruthy();
  });
});

describe('the icon, and the tri-state the create form gets right for the wrong reason', () => {
  // Obligation 3 — THE case this feature most easily gets wrong.
  //
  // The create form maps an empty icon field to an OMITTED key, which is correct
  // there (a new entry has no icon to clear) and wrong here. The service reads
  // absent as "leave it alone", so copying that mapping would make "remove the
  // icon" a write that reports success and changes nothing.
  it('sends `icon: null` when an existing icon is CLEARED', async () => {
    fireEvent.change(
      renderRow({ editing: true }, EDITED) && iconField(),
      { target: { value: '' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patchJson).toHaveBeenCalled());
    const [, body] = patchJson.mock.calls[0] as [string, Record<string, unknown>];
    expect('icon' in body).toBe(true);
    expect(body.icon).toBeNull();
  });

  it('sends NOTHING for the icon when it was not touched, so a relabel cannot wipe it', async () => {
    renderRow({ editing: true }, EDITED);

    fireEvent.change(screen.getByLabelText('Nombre (Español)'), {
      target: { value: 'Comedor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patchJson).toHaveBeenCalled());
    const [, body] = patchJson.mock.calls[0] as [string, Record<string, unknown>];
    expect('icon' in body).toBe(false);
  });

  it('sends the name when an icon is CHOSEN on an entry that had none', async () => {
    renderRow({ editing: true });

    fireEvent.change(iconField(), { target: { value: 'restaurant' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patchJson).toHaveBeenCalled());
    const [, body] = patchJson.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.icon).toBe('restaurant');
  });

  it('refuses to send a name that is not a real icon', () => {
    renderRow({ editing: true }, EDITED);

    fireEvent.change(iconField(), { target: { value: 'not_a_real_icon' } });

    // Validated against the real 4,271-name set, not a pattern — a pattern
    // accepts `not_a_real_icon`, which stores cleanly and renders nothing.
    expect(screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled')).toBe(true);
    expect(patchJson).not.toHaveBeenCalled();
  });
});

describe('the scope of a service (US3)', () => {
  /** A service that is scoped to one business type today. */
  const SCOPED = {
    key: 'kids-menu',
    labelI18n: { es: 'Menú infantil', en: 'Kids menu' },
    scope: { universal: false, businessTypes: ['restaurant-cafe'] },
    active: true,
    createdAt: 1,
  };

  it('does NOT offer a scope control on business types or moods', () => {
    renderRow({ editing: true });
    expect(screen.queryByText('Aplica a')).toBeNull();
  });

  it('offers it on services', () => {
    renderRow({ vocabulary: 'services', entryKey: 'kids-menu', editing: true }, SCOPED);
    expect(screen.getByText('Aplica a')).toBeTruthy();
  });

  // FR-009.
  it('refuses to save a specific scope that names zero business types', () => {
    renderRow({ vocabulary: 'services', entryKey: 'kids-menu', editing: true }, SCOPED);

    // Deselect the only type it has.
    fireEvent.click(screen.getByRole('button', { name: 'Restaurante o cafetería' }));

    expect(screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Elegí al menos un tipo de negocio.')).toBeTruthy();
    expect(patchJson).not.toHaveBeenCalled();
  });

  it('sends the scope when it moves to universal', async () => {
    renderRow({ vocabulary: 'services', entryKey: 'kids-menu', editing: true }, SCOPED);

    fireEvent.click(screen.getByRole('button', { name: 'Todos los tipos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patchJson).toHaveBeenCalled());
    const [, body] = patchJson.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.scope).toEqual({ universal: true });
  });

  it('sends NOTHING for the scope when only the label changed', async () => {
    renderRow({ vocabulary: 'services', entryKey: 'kids-menu', editing: true }, SCOPED);

    fireEvent.change(screen.getByLabelText('Nombre (Español)'), {
      target: { value: 'Menú para niños' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patchJson).toHaveBeenCalled());
    const [, body] = patchJson.mock.calls[0] as [string, Record<string, unknown>];
    expect('scope' in body).toBe(false);
  });
});

describe('when a save fails', () => {
  // Obligation 5.
  it('keeps the row open with what was typed, and shows the reason', async () => {
    patchJson.mockRejectedValue(new Error('Se cayó la red'));
    const { props } = renderRow({ editing: true });

    fireEvent.change(screen.getByLabelText('Nombre (Español)'), {
      target: { value: 'Comedor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.getByText('Se cayó la red')).toBeTruthy());
    // The row did NOT close...
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(props.onEditClose).not.toHaveBeenCalled();
    // ...and what was typed is still there to retry with.
    expect((screen.getByLabelText('Nombre (Español)') as HTMLInputElement).value).toBe('Comedor');
  });

  it('allows the save to be retried without retyping', async () => {
    patchJson.mockRejectedValueOnce(new Error('Se cayó la red')).mockResolvedValue({});
    const { props } = renderRow({ editing: true });

    fireEvent.change(screen.getByLabelText('Nombre (Español)'), {
      target: { value: 'Comedor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByText('Se cayó la red')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(patchJson).toHaveBeenCalledTimes(2);
  });
});

describe('the deactivate control is untouched by all of this', () => {
  it('is still reachable while the row is open', () => {
    renderRow({ editing: true });
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeTruthy();
  });

  it('still reads Reactivar on an inactive entry', () => {
    renderRow({ active: false });
    expect(screen.getByRole('button', { name: 'Reactivar' })).toBeTruthy();
  });
});

describe('only one row is open at a time (FR-011b)', () => {
  it('the row never decides this for itself — it is told', () => {
    // Asserted as a PROP CONTRACT rather than by rendering the screen, because
    // what makes FR-011b hold is that the row has no state of its own to leak:
    // `editing` arrives from above, and the draft is unmounted with the editor.
    const { rerender, props } = renderRow({ editing: true });
    expect(screen.getByLabelText('Nombre (Español)')).toBeTruthy();

    rerender(
      <ul>
        <TaxonomyRow {...props} editing={false} />
      </ul>,
    );
    expect(screen.queryByLabelText('Nombre (Español)')).toBeNull();
  });

  it('discards the draft when closed, so reopening starts from the stored value', async () => {
    const { rerender, props } = renderRow({ editing: true }, EDITED);

    fireEvent.change(screen.getByLabelText('Nombre (Español)'), {
      target: { value: 'Borrador perdido' },
    });

    rerender(
      <ul>
        <TaxonomyRow {...props} entry={EDITED as never} editing={false} />
      </ul>,
    );
    rerender(
      <ul>
        <TaxonomyRow {...props} entry={EDITED as never} editing={true} />
      </ul>,
    );

    expect((screen.getByLabelText('Nombre (Español)') as HTMLInputElement).value).toBe('Comida');
  });
});
