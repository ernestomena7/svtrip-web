// Feature 025: what the merchant sign-up form reads and sends.
//
// Reads go straight to the database (the owner-select policy on `business_registrations`, the owner's
// own listings); the one write goes through the BFF, because it grants a subscription and only the
// server may (feature 018).
import { getJson, postJson } from '../apiClient';
import { supabase } from '../supabase';

export interface MyRegistration {
  listingId: string | null;
  promotionApplied: boolean;
  /** Epoch ms, when the promotion applied. */
  freeUntil?: number;
}

/** The caller's enrolment, or null. RLS returns only their own row. */
export async function fetchMyRegistration(uid: string): Promise<MyRegistration | null> {
  const { data, error } = await supabase
    .from('business_registrations')
    .select('listing_id, promotion_applied, free_until')
    .eq('owner_uid', uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { listing_id: string | null; promotion_applied: boolean; free_until: string | null };
  return {
    listingId: row.listing_id,
    promotionApplied: row.promotion_applied,
    ...(row.free_until ? { freeUntil: Date.parse(row.free_until) } : {}),
  };
}

/** How many places the account already manages — an existing merchant gets a note on Step 2. */
export async function countOwnedListings(uid: string): Promise<number> {
  const { count, error } = await supabase.from('listings').select('id', { count: 'exact', head: true }).eq('owner_uid', uid);
  if (error) throw error;
  return count ?? 0;
}

export interface BusinessSignupRequest {
  name: string;
  businessType: string;
  moods: string[];
  location: { lat: number; lng: number; label: string; municipality: string | null };
  openingHours: { day: number; open: string; close: string; closed: boolean }[];
  phone: string | null;
  whatsapp: string | null;
  description: string;
  photos: string[];
  website: string | null;
  socialLinks: string[];
  language: 'es' | 'en';
  origin: string;
}

export interface BusinessSignupResponse {
  listingId: string;
  visible: boolean;
  promotion: null | { plan: 'premium'; freeUntil: string; freeUntilLocal: string };
  welcomeEmail: 'sent' | 'pending';
}

export function submitBusinessSignup(req: BusinessSignupRequest): Promise<BusinessSignupResponse> {
  return postJson<BusinessSignupResponse>('/business-signup', req);
}

export function reverseGeocode(lat: number, lng: number, language: 'es' | 'en'): Promise<{ label: string; municipality: string | null }> {
  return getJson(`/geocode/reverse?lat=${lat}&lng=${lng}&language=${language}`);
}
