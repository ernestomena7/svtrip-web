// Create / edit a business (feature 007, T098/T109 — FR-031 to FR-036).
//
// A real page, not a slide-up sheet. The mobile app uses a sheet because a phone
// has one column and no room for a frame around it; on a desktop that same sheet
// would be a tall thin strip down the middle of a wide screen. So the fields sit
// in a two-column grid with the publication checklist parked in a sticky rail,
// visible the whole time an owner is filling things in rather than found by
// scrolling to the end.
//
// TWO REFUSALS ARE PRODUCT RULES, not validation preferences:
//   - a save that leaves one language empty is refused, and the message NAMES
//     the missing language (FR-031);
//   - a live, complete business may not delete its last photo (FR-023) — the
//     rules refuse that write anyway, so refusing here explains why instead of
//     failing later with a generic error.
//
// And one that is neither: a business already BELOW the publication floor stays
// editable. Blocking it would trap its manager away from the only screen that
// can fix what is missing.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CONTENT_VERSION,
  MOODS,
  isFoodType,
  isLocalizedComplete,
  isPublishable,
  isLatInput,
  isLngInput,
  isValidPhone,
  normalizePhone,
  servicesFor,
  type BusinessType,
  type Listing,
} from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { createListing, updateListing, type ListingInput } from '@svtrip/core/repos/listingsRepo';
import { canManageAnotherPlace } from '@svtrip/shared';
import { useEntitlements } from '@svtrip/core/repos/useEntitlements';
import { TaxonomyGlyph } from '@svtrip/core/TaxonomyGlyph';
import { useMergedTaxonomy, useScopedServices } from '@svtrip/core/taxonomy/useTaxonomy';
import { Field, Button, Card, Chip, cx } from '../components/ui';
import { BilingualField, fromLegacy } from './BilingualField';
import { BusinessTypePicker } from './BusinessTypePicker';
import { ContactFields } from './ContactFields';
import { MediaManager } from './MediaManager';
import { OpeningHoursEditor, defaultOpeningHours } from './OpeningHoursEditor';
import { PublicationChecklist } from './PublicationChecklist';
import { LocationPicker } from './LocationPicker';
import { PRICE_BANDS, priceBandLabelKey, type PriceBand } from '@svtrip/shared';

export function ListingForm({
  existing,
  onClose,
}: {
  existing: Listing | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const legacyName = existing?.name ?? '';
  const legacyDescription = existing?.description ?? '';
  const [nameI18n, setNameI18n] = useState(() => fromLegacy(legacyName, existing?.nameI18n));
  const [descriptionI18n, setDescriptionI18n] = useState(() =>
    fromLegacy(legacyDescription, existing?.descriptionI18n),
  );
  const [lat, setLat] = useState(existing ? String(existing.lat) : '');
  const [lng, setLng] = useState(existing ? String(existing.lng) : '');
  const [hours, setHours] = useState(existing?.openingHours ?? defaultOpeningHours());
  const [moods, setMoods] = useState<string[]>(existing?.moods ?? []);
  const [priceBand, setPriceBand] = useState<PriceBand | undefined>(existing?.priceBand);
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [businessType, setBusinessType] = useState<BusinessType | undefined>(existing?.businessType);
  const [bannerURL, setBannerURL] = useState<string | undefined>(existing?.bannerURL);
  const [gallery, setGallery] = useState<string[]>(existing?.gallery ?? []);
  const [services, setServices] = useState<string[]>(existing?.services ?? []);
  const [menuImages, setMenuImages] = useState<string[]>(existing?.menuImages ?? []);
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(existing?.whatsapp ?? '');
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const { planCode, managedPlaceIds } = useEntitlements();
  const [saveError, setSaveError] = useState<string | null>(null);

  // T109 — session expiry mid-edit. A business profile takes real minutes to
  // fill in, which makes this the one screen where losing the session quietly is
  // genuinely expensive. The work stays on screen and the message says what to
  // do; nothing is discarded and nothing is auto-submitted into a void.
  const [sessionLost, setSessionLost] = useState(false);
  useEffect(() => {
    // Follows the session in BOTH directions. Setting it only on loss meant a
    // momentary null — a token refresh — left the warning up permanently on a
    // form that was perfectly usable, telling the owner to sign in again while
    // they already were.
    setSessionLost(!user);
  }, [user]);

  const nameOk = isLocalizedComplete(nameI18n);
  const descriptionOk = isLocalizedComplete(descriptionI18n);
  const missingLanguages = [
    ...(nameI18n.es.trim() && nameI18n.en.trim() ? [] : ['name']),
    ...(descriptionI18n.es.trim() && descriptionI18n.en.trim() ? [] : ['description']),
  ];
  // Absence first: `Number('')` is 0 and 0 is a valid latitude, so a range
  // check alone let an untouched map save the business at 0,0.
  const coordsOk = isLatInput(lat) && isLngInput(lng);
  const phonesBad = !isValidPhone(phone) || !isValidPhone(whatsapp);
  const canSave = nameOk && descriptionOk && coordsOk && !phonesBad && !saving && !sessionLost;

  /** Live AND complete is the only state the last photo is protected in (FR-023). */
  const lastPhotoLocked = Boolean(existing && existing.active !== false && isPublishable(existing));

  const availableServices = servicesFor(businessType);
  // Admin-managed vocabularies (feature 010). `servicesFor()` still owns which
  // BUILT-IN services suit this type; admin-created ones carry their own scope,
  // so both are merged here rather than either one deciding alone.
  const {
    keys: moodKeys,
    label: moodLabel,
    icon: moodGlyph,
  } = useMergedTaxonomy('moods', MOODS, moods);
  const { keys: scopedServices, label: serviceLabel } = useScopedServices(
    businessType,
    availableServices,
    services,
  );

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function save() {
    if (!user || !canSave) return;
    setSaving(true);
    setSaveError(null);
    const input: ListingInput = {
      // The flat fields stay in sync with Español: everything not yet migrated to
      // the resolver still reads them, and a stale flat field renders the old
      // name in those places.
      name: nameI18n.es.trim() || legacyName.trim(),
      description: descriptionI18n.es.trim() || legacyDescription.trim(),
      nameI18n: { es: nameI18n.es.trim(), en: nameI18n.en.trim() },
      descriptionI18n: { es: descriptionI18n.es.trim(), en: descriptionI18n.en.trim() },
      photos,
      // Omitted entirely when blank: Firestore rejects `undefined`, and an empty
      // string makes the contact button render with nothing behind it.
      ...(normalizePhone(phone).trim() ? { phone: normalizePhone(phone).trim() } : {}),
      ...(normalizePhone(whatsapp).trim() ? { whatsapp: normalizePhone(whatsapp).trim() } : {}),
      lat: Number(lat),
      lng: Number(lng),
      openingHours: hours,
      moods,
      ...(priceBand ? { priceBand } : {}),
      active,
      ...(businessType ? { businessType } : {}),
      ...(bannerURL ? { bannerURL } : {}),
      gallery,
      services,
      menuImages,
    };
    try {
      if (existing) await updateListing(existing.listingId, input);
      else {
        // FR-050. The cap cannot live in the rules — Firestore cannot count
        // (research R8) — and it is really expressed by what the subscription
        // COVERS: a second place on Básico is simply not covered, therefore not
        // visible. This guard is what SAYS SO, instead of leaving the merchant
        // with an invisible listing and no explanation.
        if (!canManageAnotherPlace(planCode ?? 'basico', managedPlaceIds.length)) {
          setPremiumRequired(true);
          return;
        }
        await createListing(user.uid, input);
      }
      onClose();
    } catch {
      setSaveError(t('common.somethingWrong'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
          {existing ? t('services.editListing') : t('services.newListing')}
        </h1>

        <BilingualField
          label={t('services.name')}
          value={nameI18n}
          onChange={setNameI18n}
          placeholder={t('services.namePlaceholder')}
        />
        <BilingualField
          label={t('services.description')}
          value={descriptionI18n}
          onChange={setDescriptionI18n}
          multiline
        />

        <BusinessTypePicker value={businessType} onChange={setBusinessType} />
        {/*
          The optional price band (feature 014). A RANGE, never an amount: an
          exact price is the field that goes stale fastest and nobody returns
          to update, and a wrong price on a card is worse than none.
        
          "Not specified" is a real choice and the default — every one of the 18
          seed destinations sits here, and their cards simply omit the line.
        */}
        <Field label={t('pricing.label')}>
          <p className="pb-1 text-xs text-muted">{t('pricing.hint')}</p>
          <div className="flex flex-wrap gap-2">
            {[undefined, ...PRICE_BANDS].map((band) => {
              const on = priceBand === band;
              return (
                <button
                  key={band ?? 'none'}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPriceBand(band)}
                  className={cx(
                    'rounded-pill border px-3.5 py-2 text-sm font-bold transition',
                    on
                      ? 'border-transparent bg-sunset text-white shadow-red'
                      : 'border-border bg-surface text-text',
                  )}
                >
                  {band ? t(priceBandLabelKey(band)) : t('pricing.none')}
                </button>
              );
            })}
          </div>
        </Field>

        <MediaManager
          label={t('services.photos')}
          urls={photos}
          onChange={setPhotos}
          lockLast={lastPhotoLocked}
        />
        <MediaManager
          label={t('services.banner')}
          urls={bannerURL ? [bannerURL] : []}
          onChange={(next) => setBannerURL(next[0])}
          single
          aspect="wide"
        />
        <MediaManager label={t('services.gallery')} urls={gallery} onChange={setGallery} />
        {isFoodType(businessType) && (
          <MediaManager
            label={t('services.menu')}
            hint={t('services.menuHint')}
            urls={menuImages}
            onChange={setMenuImages}
            aspect="tall"
          />
        )}

        <ContactFields
          phone={phone}
          whatsapp={whatsapp}
          onPhoneChange={setPhone}
          onWhatsappChange={setWhatsapp}
        />

        <div className="space-y-2">
          <p className="text-sm font-bold text-muted">{t('services.additionalServices')}</p>
          <div className="flex flex-wrap gap-2">
            {scopedServices.map((key) => (
              <Chip
                key={key}
                active={services.includes(key)}
                onClick={() => toggle(services, key, setServices)}
              >
                {serviceLabel(key)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold text-muted">{t('services.vibes')}</p>
          <div className="flex flex-wrap gap-2">
            {moodKeys.map((mood) => (
              <Chip
                key={mood}
                active={moods.includes(mood)}
                iconLeft={<TaxonomyGlyph resolved={moodGlyph(mood)} size={14} />}
                onClick={() => toggle(moods, mood, setMoods)}
              >
                {moodLabel(mood)}
              </Chip>
            ))}
          </div>
        </div>

        <LocationPicker
          lat={lat}
          lng={lng}
          onChange={(next) => {
            setLat(next.lat);
            setLng(next.lng);
          }}
        />

        <div className="space-y-2">
          <p className="text-sm font-bold text-muted">{t('services.openingHours')}</p>
          <OpeningHoursEditor hours={hours} onChange={setHours} />
        </div>
      </div>

      {/* The rail: status and the save action, in view the whole way down. */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <PublicationChecklist
          entry={{
            photos,
            gallery,
            businessType,
            active,
            nameI18n,
            descriptionI18n,
            // Saving stamps this, so the checklist must judge the entry by the
            // rules it is ABOUT to be held to, not the ones it escaped.
            contentVersion: CONTENT_VERSION,
          }}
        />

        <Card className="space-y-3 p-5">
          <button
            type="button"
            onClick={() => setActive((a) => !a)}
            className="flex w-full items-center justify-between"
          >
            <span className="text-sm font-bold text-text">{t('services.active')}</span>
            <span
              className={cx(
                'h-6 w-11 rounded-full p-0.5 transition',
                active ? 'bg-sunset' : 'bg-border',
              )}
            >
              <span
                className={cx(
                  'block h-5 w-5 rounded-full bg-white transition',
                  active && 'translate-x-5',
                )}
              />
            </span>
          </button>

          {/* Names what is missing rather than leaving a disabled button with no
              explanation — the most common way a form dead-ends. */}
          {missingLanguages.length > 0 && (
            <p className="text-sm font-bold text-primary">
              {t('bilingual.incomplete', {
                fields: missingLanguages.map((f) => t(`services.${f}`)).join(', '),
              })}
            </p>
          )}
          {!coordsOk && <p className="text-sm font-bold text-primary">{t('services.locationMissing')}</p>}
          {saveError && <p className="text-sm font-bold text-primary">{saveError}</p>}

          {sessionLost && (
            <div className="rounded-md bg-surface-2 p-3" role="alert">
              <p className="text-sm font-bold text-text">{t('web.gated.title')}</p>
              <p className="mt-1 text-xs text-muted">{t('services.sessionLostHint')}</p>
              <a
                href="/sign-in"
                className="mt-2 inline-block text-sm font-extrabold text-primary underline"
              >
                {t('web.preview.cta')}
              </a>
            </div>
          )}

          {/* FR-050: says WHY rather than leaving the merchant with a listing
              that saves and never appears. The cap cannot live in the rules
              (Firestore cannot count), so this is the only place it is visible. */}
          {premiumRequired && (
            <p className="rounded-md bg-surface-2 p-3.5 text-sm font-bold text-primary">
              {t('subscription.secondPlaceNeedsPremium')}
            </p>
          )}

          <Button fullWidth iconLeft="check" disabled={!canSave} onClick={() => void save()}>
            {saving ? t('common.loading') : t('services.save')}
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('common.close')}
          </Button>
        </Card>
      </aside>
    </div>
  );
}
