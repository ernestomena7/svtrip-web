// Feature 025, Step 2 of 2 — the business (FR-014–FR-017).
//
// Built from the controls the listing form already uses — BusinessTypePicker (live taxonomy),
// LocationPicker (keyless map + address search), OpeningHoursEditor, ContactFields, MediaManager —
// so there is one version of each control in the product (Principle VI). New here: ONE mood (single
// select over the live taxonomy), a 300-character description, optional website and social links, and
// a reverse lookup that turns a pin into an address label and a municipality (R10).
//
// Nothing typed or uploaded is lost (FR-015): the draft lives in state and in sessionStorage, and a
// refusal from the server marks the fields it names without clearing anything.
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MOODS, isValidPhone, normalizePhone, type BusinessType, type OpeningHour } from '@svtrip/shared';
import { TaxonomyGlyph } from '@svtrip/core/TaxonomyGlyph';
import { useMergedTaxonomy } from '@svtrip/core/taxonomy/useTaxonomy';
import { reverseGeocode, submitBusinessSignup, type BusinessSignupResponse } from '@svtrip/core/repos/businessSignupRepo';
import { Button, Chip, Field, TextArea, TextInput } from '../components/ui';
import { BusinessTypePicker } from '../business/BusinessTypePicker';
import { DEFAULT_CENTER, LocationPicker } from '../business/LocationPicker';
import { OpeningHoursEditor, defaultOpeningHours } from '../business/OpeningHoursEditor';
import { ContactFields } from '../business/ContactFields';
import { MediaManager } from '../business/MediaManager';
import { TermsCheckbox } from './TermsCheckbox';
import { clearDraft, loadDraft, saveDraft, type SignupContext } from './signupContext';

export const DESCRIPTION_MAX = 300;
const SOCIAL_MAX = 5;

interface Draft {
  name: string;
  businessType?: BusinessType;
  moods: string[];
  lat: string;
  lng: string;
  label: string;
  municipality: string | null;
  hours: OpeningHour[];
  phone: string;
  whatsapp: string;
  description: string;
  photos: string[];
  website: string;
  socialLinks: string[];
  /** The merchant searched or moved the pin (the starting San Salvador point does not count). */
  pinSet?: boolean;
}

type FieldKey = 'name' | 'businessType' | 'moods' | 'location' | 'hours' | 'contact' | 'description' | 'photos' | 'website' | 'socialLinks';

/** Server `issues[].path` → the field to mark (contracts/signup-api.md). */
function fieldOf(path: string): FieldKey | null {
  const head = path.split('.')[0];
  if (head === 'openingHours') return 'hours';
  if (head === 'phone' || head === 'whatsapp') return 'contact';
  if (head === 'location') return 'location';
  return (['name', 'businessType', 'moods', 'description', 'photos', 'website', 'socialLinks'] as const).find((k) => k === head) ?? null;
}

export function Step2Business({
  ctx,
  needsTerms,
  existingMerchant,
  onTermsAccepted,
  onDone,
  onAlreadyRegistered,
}: {
  ctx: SignupContext;
  /** The account has not accepted the current Terms/Privacy versions (R12a). */
  needsTerms: boolean;
  /** The account already manages places: the new one joins its account and plan. */
  existingMerchant: boolean;
  onTermsAccepted: () => Promise<void>;
  onDone: (result: BusinessSignupResponse) => void;
  onAlreadyRegistered: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() => ({
    name: '',
    moods: [],
    // San Salvador is where the map opens AND the starting location (product owner): the merchant
    // searches or moves the pin from there. Strings, as the picker emits them.
    lat: String(DEFAULT_CENTER.lat),
    lng: String(DEFAULT_CENTER.lng),
    label: '',
    municipality: null,
    hours: defaultOpeningHours(),
    phone: '',
    whatsapp: '',
    description: '',
    photos: [],
    website: '',
    socialLinks: [],
    ...loadDraft<Draft>(),
  }));
  // A draft saved before moods became a list carries a single `mood`: keep the choice.
  useEffect(() => {
    const legacy = (loadDraft<{ mood?: string }>().mood ?? '').trim();
    if (legacy) setDraft((d) => (d.moods.length ? d : { ...d, moods: [legacy] }));
  }, []);
  // A saved draft from before this default carried an empty location: fall back to San Salvador.
  useEffect(() => {
    setDraft((d) => (d.lat && d.lng ? d : { ...d, lat: String(DEFAULT_CENTER.lat), lng: String(DEFAULT_CENTER.lng) }));
  }, []);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Set<FieldKey>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef<Partial<Record<FieldKey, HTMLDivElement | null>>>({});
  const { keys: moodKeys, label: moodLabel, icon: moodGlyph } = useMergedTaxonomy('moods', MOODS, draft.moods);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  useEffect(() => saveDraft(draft), [draft]);

  // A pin placed or moved by hand → an address label and a municipality (R10). Best effort: the
  // coordinates are what matter, and a failed lookup leaves them as they are.
  useEffect(() => {
    const lat = Number(draft.lat);
    const lng = Number(draft.lng);
    if (!draft.lat || !draft.lng || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const timer = setTimeout(() => {
      reverseGeocode(lat, lng, ctx.lang)
        .then((r) => setDraft((d) => (d.lat === String(lat) && d.lng === String(lng) ? { ...d, label: r.label, municipality: r.municipality } : d)))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [draft.lat, draft.lng, ctx.lang]);

  const localErrors = useMemo(() => {
    const e = new Set<FieldKey>();
    if (draft.name.trim().length < 2) e.add('name');
    if (!draft.businessType) e.add('businessType');
    if (draft.moods.length === 0) e.add('moods');
    if (!draft.lat || !draft.lng) e.add('location');
    if (draft.hours.length !== 7) e.add('hours');
    const phone = normalizePhone(draft.phone).trim();
    const wa = normalizePhone(draft.whatsapp).trim();
    if ((!phone && !wa) || (phone && !isValidPhone(phone)) || (wa && !isValidPhone(wa))) e.add('contact');
    if (!draft.description.trim() || draft.description.length > DESCRIPTION_MAX) e.add('description');
    if (draft.photos.length === 0) e.add('photos');
    if (draft.website && !/^https?:\/\//.test(draft.website)) e.add('website');
    if (draft.socialLinks.some((s) => s && !/^https?:\/\//.test(s))) e.add('socialLinks');
    return e;
  }, [draft]);

  function focusFirst(keys: Set<FieldKey>) {
    const order: FieldKey[] = ['name', 'businessType', 'moods', 'location', 'hours', 'contact', 'description', 'photos', 'website', 'socialLinks'];
    const first = order.find((k) => keys.has(k));
    const el = first ? refs.current[first] : null;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    el?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFailed(null);
    if (needsTerms && !accepted) return;
    if (localErrors.size) {
      setErrors(localErrors);
      focusFirst(localErrors);
      return;
    }
    setBusy(true);
    try {
      if (needsTerms) await onTermsAccepted();
      const phone = normalizePhone(draft.phone).trim();
      const wa = normalizePhone(draft.whatsapp).trim();
      const result = await submitBusinessSignup({
        name: draft.name.trim(),
        businessType: draft.businessType!,
        moods: draft.moods,
        location: { lat: Number(draft.lat), lng: Number(draft.lng), label: draft.label, municipality: draft.municipality },
        openingHours: draft.hours,
        phone: phone || null,
        whatsapp: wa || null,
        description: draft.description.trim(),
        photos: draft.photos,
        website: draft.website.trim() || null,
        socialLinks: draft.socialLinks.map((s) => s.trim()).filter(Boolean),
        language: ctx.lang,
        origin: ctx.origin,
      });
      clearDraft();
      onDone(result);
    } catch (err) {
      const e2 = err as { status?: number; code?: string; details?: { issues?: { path: string }[] } };
      if (e2.code === 'already_registered') {
        clearDraft();
        onAlreadyRegistered();
        return;
      }
      const marked = new Set<FieldKey>();
      for (const issue of e2.details?.issues ?? []) {
        const f = fieldOf(issue.path);
        if (f) marked.add(f);
      }
      if (e2.code === 'unknown_mood') marked.add('moods');
      if (e2.code === 'unknown_business_type') marked.add('businessType');
      if (e2.code === 'photo_not_owned') marked.add('photos');
      setErrors(marked);
      setFailed(t(e2.status === 429 ? 'signup.errors.tooMany' : marked.size ? 'signup.errors.fix' : 'common.somethingWrong'));
      if (marked.size) focusFirst(marked);
    } finally {
      setBusy(false);
    }
  }

  const bad = (k: FieldKey) => errors.has(k);
  const hint = (k: FieldKey) =>
    bad(k) ? (
      <p className="mt-1 text-sm font-bold text-primary" role="alert" data-testid={`error-${k}`}>
        {t(`signup.errors.${k}`)}
      </p>
    ) : null;
  const block = (k: FieldKey) => (el: HTMLDivElement | null) => {
    refs.current[k] = el;
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {existingMerchant && <p className="rounded-md bg-surface-2 p-3.5 text-sm text-text">{t('signup.step2.existingMerchant')}</p>}

      <div ref={block('name')}>
        <Field label={t('signup.step2.name')}>
          <TextInput value={draft.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />
        </Field>
        {hint('name')}
      </div>

      <div ref={block('businessType')}>
        <BusinessTypePicker value={draft.businessType} onChange={(v) => set('businessType', v)} />
        {hint('businessType')}
      </div>

      <div ref={block('moods')}>
        <p className="text-sm font-bold text-text">{t('signup.step2.mood')}</p>
        <p className="mt-0.5 text-sm text-muted">{t('signup.step2.moodHint')}</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t('signup.step2.mood')}>
          {moodKeys.map((key) => (
            <Chip key={key} active={draft.moods.includes(key)} onClick={() => set('moods', draft.moods.includes(key) ? draft.moods.filter((m) => m !== key) : [...draft.moods, key])} iconLeft={<TaxonomyGlyph resolved={moodGlyph(key)} size={15} />}>
              {moodLabel(key)}
            </Chip>
          ))}
        </div>
        {hint('moods')}
      </div>

      <div ref={block('location')}>
        <p className="mb-2 text-sm font-bold text-text">{t('signup.step2.address')}</p>
        <LocationPicker lat={draft.lat} lng={draft.lng} onChange={(n) => setDraft((d) => ({ ...d, lat: n.lat, lng: n.lng, pinSet: true }))} />
        {/* The map starts at San Salvador, so a place elsewhere keeps a WRONG location unless the
            merchant moves the pin. This line stays until they do (product owner, option B). */}
        {!draft.pinSet && (
          <p className="mt-2 rounded-md bg-surface-2 p-3 text-sm font-bold text-text" role="note" data-testid="signup-pin-hint">
            {t('signup.step2.pinHint')}
          </p>
        )}
        {draft.label && <p className="mt-2 text-sm text-muted" data-testid="signup-address-label">{draft.label}</p>}
        {hint('location')}
      </div>

      <div ref={block('hours')}>
        <p className="mb-2 text-sm font-bold text-text">{t('signup.step2.hours')}</p>
        <OpeningHoursEditor hours={draft.hours} onChange={(h) => set('hours', h)} />
        {hint('hours')}
      </div>

      <div ref={block('contact')}>
        <ContactFields phone={draft.phone} whatsapp={draft.whatsapp} onPhoneChange={(v) => set('phone', v)} onWhatsappChange={(v) => set('whatsapp', v)} />
        {hint('contact')}
      </div>

      <div ref={block('description')}>
        <Field label={t('signup.step2.description')}>
          <TextArea
            rows={4}
            value={draft.description}
            maxLength={DESCRIPTION_MAX}
            onChange={(e) => set('description', e.target.value.slice(0, DESCRIPTION_MAX))}
            data-testid="signup-description"
          />
        </Field>
        <p className="mt-1 text-right text-sm text-muted" aria-live="polite" data-testid="signup-description-count">
          {draft.description.length}/{DESCRIPTION_MAX}
        </p>
        {hint('description')}
      </div>

      <div ref={block('photos')}>
        <MediaManager label={t('signup.step2.photos')} hint={t('signup.step2.photosHint')} urls={draft.photos} onChange={(p) => set('photos', p)} />
        {hint('photos')}
      </div>

      <div ref={block('website')}>
        <Field label={`${t('signup.step2.website')} ${t('signup.optional')}`}>
          <TextInput type="url" inputMode="url" placeholder="https://" value={draft.website} onChange={(e) => set('website', e.target.value)} maxLength={200} />
        </Field>
        {hint('website')}
      </div>

      <div ref={block('socialLinks')} className="space-y-2">
        <p className="text-sm font-bold text-text">
          {t('signup.step2.social')} <span className="font-normal text-muted">{t('signup.optional')}</span>
        </p>
        {draft.socialLinks.map((link, i) => (
          <div key={i} className="flex gap-2">
            <TextInput
              type="url"
              inputMode="url"
              placeholder="https://instagram.com/…"
              value={link}
              onChange={(e) => set('socialLinks', draft.socialLinks.map((s, j) => (j === i ? e.target.value : s)))}
              maxLength={200}
              aria-label={t('signup.step2.social')}
            />
            <Button variant="secondary" type="button" onClick={() => set('socialLinks', draft.socialLinks.filter((_, j) => j !== i))}>
              {t('signup.step2.remove')}
            </Button>
          </div>
        ))}
        {draft.socialLinks.length < SOCIAL_MAX && (
          <Button variant="secondary" type="button" iconLeft="plus" onClick={() => set('socialLinks', [...draft.socialLinks, ''])}>
            {t('signup.step2.addSocial')}
          </Button>
        )}
        {hint('socialLinks')}
      </div>

      {needsTerms && <TermsCheckbox checked={accepted} onChange={setAccepted} />}

      {failed && (
        <p className="text-sm font-bold text-primary" role="alert">
          {failed}
        </p>
      )}

      <Button type="submit" fullWidth size="lg" disabled={busy || (needsTerms && !accepted)}>
        {busy ? t('auth.loading') : t('signup.step2.submit')}
      </Button>
    </form>
  );
}
