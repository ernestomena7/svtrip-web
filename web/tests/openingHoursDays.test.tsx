// The hours editor must show the day in the visitor's language (found by feature 025's T033).
// Its key list said 'sunday'..'saturday' while the locale files key the days 'sun'..'sat', so every
// lookup missed and the literal English word was painted in both languages.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@svtrip/core/i18n';
import i18n from '@svtrip/core/i18n';
import { OpeningHoursEditor, defaultOpeningHours } from '../src/business/OpeningHoursEditor';

afterEach(cleanup);

describe('OpeningHoursEditor day names', () => {
  it('Spanish: Dom … Sáb, and never the English word', async () => {
    await i18n.changeLanguage('es');
    render(<OpeningHoursEditor hours={defaultOpeningHours()} onChange={() => {}} />);
    expect(screen.getByText('Dom')).toBeTruthy();
    expect(screen.getByText('Lun')).toBeTruthy();
    expect(screen.queryByText('sunday')).toBeNull();
    expect(screen.queryByText('monday')).toBeNull();
  });

  it('English: Sun … Sat (the allow beside the deny)', async () => {
    await i18n.changeLanguage('en');
    render(<OpeningHoursEditor hours={defaultOpeningHours()} onChange={() => {}} />);
    expect(screen.getByText('Sun')).toBeTruthy();
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.queryByText('sunday')).toBeNull();
  });
});
