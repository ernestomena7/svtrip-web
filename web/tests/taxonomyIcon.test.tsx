// Choosing a taxonomy icon in the admin form (feature 014, US4 — FR-028/FR-029).
//
// What matters here is that an admin sees the icon BEFORE saving, and cannot
// save a name that will render nothing. The second half is enforced on the
// server too, against the same list — this only saves a round trip, and the test
// says so rather than letting the form look like the boundary.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}));

import { IconField, isSubmittableIcon } from '../src/admin/IconField';

// This suite renders the same component repeatedly; without an explicit
// cleanup they stack up in the document and every getBy* finds several.
afterEach(cleanup);

const preview = () => screen.getByTestId('icon-preview');

describe('the preview', () => {
  it('shows nothing for an empty field', () => {
    render(<IconField value="" onChange={() => undefined} />);
    expect(preview().textContent).toBe('—');
  });

  it('renders the glyph for a real icon name', () => {
    render(<IconField value="beach_access" onChange={() => undefined} />);
    // A rendered glyph, not the name as text — the whole reason icons draw by
    // codepoint rather than by ligature.
    expect(preview().textContent).not.toBe('—');
    expect(preview().textContent).not.toContain('beach_access');
  });

  it('shows nothing for a name that does not exist', () => {
    render(<IconField value="not_a_real_icon" onChange={() => undefined} />);
    expect(preview().textContent).toBe('—');
  });
});

describe('refusing an unknown name', () => {
  it('marks the input invalid', () => {
    render(<IconField value="not_a_real_icon" onChange={() => undefined} />);
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('does not mark a real name invalid', () => {
    render(<IconField value="hiking" onChange={() => undefined} />);
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBeNull();
  });

  it('does not mark an EMPTY field invalid — the icon is optional', () => {
    // FR-035. Treating empty as an error would make the field required and
    // block every entry that does not want one.
    render(<IconField value="" onChange={() => undefined} />);
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBeNull();
  });

  it('explains the problem once the field has been left', () => {
    render(<IconField value="not_a_real_icon" onChange={() => undefined} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByText('admin.iconUnknown')).toBeDefined();
  });
});

describe('helping the admin find a name', () => {
  it('offers suggestions when the field is empty', () => {
    render(<IconField value="" onChange={() => undefined} />);
    expect(screen.getByLabelText('person_check')).toBeDefined();
  });

  it('offers prefix matches while typing something incomplete', () => {
    render(<IconField value="beach" onChange={() => undefined} />);
    expect(screen.getByText('beach_access')).toBeDefined();
  });

  it('stops suggesting once the name is exact', () => {
    render(<IconField value="beach_access" onChange={() => undefined} />);
    // The name resolves, so the list is noise at this point.
    expect(screen.queryByText('beach_access')).toBeNull();
  });

  it('picks a suggestion into the field', () => {
    const onChange = vi.fn();
    render(<IconField value="" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('surfing'));
    expect(onChange).toHaveBeenCalledWith('surfing');
  });
});

describe('isSubmittableIcon', () => {
  it('accepts empty, because the field is optional', () => {
    expect(isSubmittableIcon('')).toBe(true);
    expect(isSubmittableIcon('   ')).toBe(true);
  });

  it('accepts a real name', () => {
    expect(isSubmittableIcon('person_check')).toBe(true);
  });

  it('refuses a name that resolves to nothing', () => {
    expect(isSubmittableIcon('not_a_real_icon')).toBe(false);
  });

  it('refuses a name that only LOOKS like one', () => {
    // The case a regex validator would wave through.
    expect(isSubmittableIcon('beach_accesss')).toBe(false);
  });
});
