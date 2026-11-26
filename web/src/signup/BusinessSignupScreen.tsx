// Feature 025: the merchant enrolment, at /negocios/registro (EN /en/business/register).
//
// Rendered by AppRoutes ABOVE the first-run gates (research R1a): a brand-new account exists the instant
// Step 1 calls sign-up (production auto-confirms, R2), and without this the profile and mood gates would
// send a merchant into traveler onboarding before Step 2.
//
// The routing table (contracts/pages.md), first matching row:
//   signed out                                  → Step 1
//   has a registration                          → its confirmation (never a second Step 2)
//   profile incomplete (Google return, or an interrupted Step 1) → Step 1 "Completá tus datos"
//   otherwise                                   → Step 2 (terms box when not current — R12a)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { currentLegalVersions, isProfileComplete } from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { auth } from '@svtrip/core/supabase';
import { recordTermsAcceptance } from '@svtrip/core/auth/userProfile';
import { useUiStore } from '@svtrip/core/uiStore';
import {
  countOwnedListings,
  fetchMyRegistration,
  type BusinessSignupResponse,
  type MyRegistration,
} from '@svtrip/core/repos/businessSignupRepo';
import { localDate } from '@svtrip/shared';
import { ErrorState, Spinner } from '../components/ui';
import { AuthShell } from '../auth/AuthShell';
import { Step1Account } from './Step1Account';
import { Step2Business } from './Step2Business';
import { SignupConfirmation, type ConfirmationKind } from './SignupConfirmation';
import { readSignupContext, rememberSignupContext } from './signupContext';
import { trackStep1Done, trackStep1Started } from './signupFunnel';

export function BusinessSignupScreen() {
  const { t } = useTranslation();
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const setLanguage = useUiStore((s) => s.setLanguage);
  const setPersona = useUiStore((s) => s.setPersona);
  const ctx = useMemo(() => readSignupContext(location.search, location.pathname), [location.search, location.pathname]);

  const [registration, setRegistration] = useState<MyRegistration | null | undefined>(undefined);
  const [owned, setOwned] = useState(0);
  const [result, setResult] = useState<BusinessSignupResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  // Step 1 finished in THIS visit. The app's live profile copy arrives later (a realtime ping, and it
  // did not arrive at all on a local stack without one), so routing on it alone left a merchant looking
  // at Step 1 again, with every field already filled in, after the data had been saved. The screen
  // advances on what it just did; the live copy catches up behind it.
  const [step1Done, setStep1Done] = useState(false);
  const [termsDone, setTermsDone] = useState(false);
  // Whether this visit STARTED signed out (decided once, when the session is known). Step 1 creates the
  // account partway through its own submit, so `user` flips from null to set while the form is still
  // working. Routing on `user` alone swapped the full form for the short "Completá tus datos" one — and
  // unmounted it behind a spinner — in the middle of the merchant's own click: two Step 1 screens in a
  // row. A merchant who started signed out stays on the full form until Step 1 is DONE.
  const startedSignedOut = useRef<boolean | null>(null);
  if (!loading && startedSignedOut.current === null) startedSignedOut.current = !user;
  const showFullStep1 = startedSignedOut.current === true && !step1Done;

  useEffect(() => {
    setLanguage(ctx.lang);
    rememberSignupContext(ctx);
  }, [ctx, setLanguage]);

  useEffect(() => {
    if (!user) {
      setRegistration(null);
      return;
    }
    let live = true;
    setFailed(false);
    Promise.all([fetchMyRegistration(user.uid), countOwnedListings(user.uid)])
      .then(([reg, count]) => {
        if (!live) return;
        setRegistration(reg);
        setOwned(count);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [user, reload]);

  const onTermsAccepted = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const v = currentLegalVersions();
    await recordTermsAcceptance(uid, { termsVersion: v.terms, privacyVersion: v.privacy });
    setTermsDone(true);
  }, []);

  const versions = currentLegalVersions();
  const step = (n: 1 | 2) => t('signup.stepOf', { step: n, total: 2 });

  if (loading || (!showFullStep1 && user && registration === undefined && !failed)) {
    return (
      <AuthShell title={t('signup.title')} width="xl">
        <Spinner label={t('common.loading')} />
      </AuthShell>
    );
  }

  if (failed) {
    return (
      <AuthShell title={t('signup.title')} width="xl">
        <ErrorState message={t('common.somethingWrong')} />
      </AuthShell>
    );
  }

  if (result || registration) {
    const kind: ConfirmationKind = result
      ? result.promotion
        ? 'promotion'
        : result.visible
          ? 'visible'
          : 'hidden'
      : registration!.promotionApplied
        ? 'promotion'
        : 'registered';
    const freeUntilLocal = result?.promotion?.freeUntilLocal ?? (registration?.freeUntil ? localDate(registration.freeUntil) : undefined);
    return (
      <AuthShell title={t('signup.done.title')} width="xl">
        <SignupConfirmation kind={kind} freeUntilLocal={freeUntilLocal} lang={ctx.lang} />
      </AuthShell>
    );
  }

  if (!user || showFullStep1) {
    return (
      <AuthShell eyebrow={step(1)} title={t('signup.step1.title')} subtitle={t('signup.step1.subtitle')} width="xl">
        <Step1Account mode="new" ctx={ctx} onStarted={() => trackStep1Started(ctx)} onDone={() => {
          trackStep1Done(ctx);
          setStep1Done(true);
        }} />
      </AuthShell>
    );
  }

  if (!step1Done && (!profile || !isProfileComplete(profile))) {
    return (
      <AuthShell eyebrow={step(1)} title={t('signup.step1.completeTitle')} subtitle={t('signup.step1.subtitle')} width="xl">
        <Step1Account mode="complete" ctx={ctx} prefill={profile} onStarted={() => trackStep1Started(ctx)} onDone={() => {
          trackStep1Done(ctx);
          setStep1Done(true);
        }} />
      </AuthShell>
    );
  }

  // `profile` may still be the pre-Step-1 copy; Step 1 records the terms, so it counts as accepted.
  const termsCurrent = termsDone || step1Done || (profile?.termsVersion === versions.terms && profile?.privacyVersion === versions.privacy);
  return (
    <AuthShell eyebrow={step(2)} title={t('signup.step2.title')} subtitle={t('signup.step2.subtitle')} width="xl">
      <Step2Business
        ctx={ctx}
        needsTerms={!termsCurrent}
        existingMerchant={owned > 0}
        onTermsAccepted={onTermsAccepted}
        onDone={(r) => {
          setPersona('provider');
          setResult(r);
        }}
        onAlreadyRegistered={() => setReload((n) => n + 1)}
      />
    </AuthShell>
  );
}
