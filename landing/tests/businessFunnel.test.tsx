// Feature 025 (US4): the business page counts ONE `page_opened` per session, in the browser only.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import '@svtrip/core/i18n';
import { BusinessPage } from '../src/business/BusinessPage';

const calls = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes('/public/signup-event'));

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 204, json: async () => ({ promotion: null, plans: [] }) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('page_opened', () => {
  it('is sent once with the visitor’s origin, and not again on a second mount in the same session', () => {
    window.history.pushState({}, '', '/negocios?utm_source=Invitacion-DIC');
    render(<BusinessPage />);
    cleanup();
    render(<BusinessPage />);
    expect(calls()).toHaveLength(1);
    expect(JSON.parse(String((calls()[0][1] as RequestInit).body))).toEqual({ step: 'page_opened', origin: 'invitacion-dic' });
  });

  it('a visitor with no link origin sends only the step', () => {
    window.history.pushState({}, '', '/negocios');
    render(<BusinessPage />);
    expect(JSON.parse(String((calls()[0][1] as RequestInit).body))).toEqual({ step: 'page_opened' });
  });

  it('is NEVER sent by the prerender: effects do not run in renderToString', () => {
    renderToString(<BusinessPage />);
    expect(calls()).toHaveLength(0);
  });
});
